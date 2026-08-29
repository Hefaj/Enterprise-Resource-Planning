using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Jobs;

/// <summary>Skanuje otwarte, przeterminowane zgłoszenia. Nie tworzy harmonogramu per zgłoszenie:
/// dzienna rozdzielczość SLA uzasadnia indeks po <c>due_at</c> i jedną dzierżawę klastra.</summary>
[ClusterSafe("Dzierżawa taskmgmt:sla-escalation sprawia, że dwie instancje nie oznaczają ani nie "
    + "eskalują tych samych zgłoszeń równolegle.")]
public sealed partial class SlaEscalationService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private const int ScanLimit = 500;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SlaEscalationService> _logger;

    public SlaEscalationService(IServiceScopeFactory scopeFactory, ILogger<SlaEscalationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await EscalateOnceAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogEscalationFailed(_logger, ex);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    private async Task EscalateOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var lease = scope.ServiceProvider.GetRequiredService<IExclusiveLease>();
        await using var held = await lease.TryAcquireAsync("taskmgmt:sla-escalation", ct).ConfigureAwait(false);
        if (held is null) return;

        var db = scope.ServiceProvider.GetRequiredService<TaskManagementDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();
        var publisher = scope.ServiceProvider.GetRequiredService<IIntegrationEventPublisher>();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var now = clock.UtcNow;
        var today = DateOnly.FromDateTime(now.UtcDateTime);

        var overdue = await (from issue in db.Issues
                             join project in db.Projects on issue.ProjectUuid equals project.Uuid
                             where issue.DueAt != null
                                && issue.DueAt < now
                                && issue.StateCategory != WorkflowStateCategory.Done
                                && project.SlaPolicy != null
                                && (issue.SlaLastNotifiedOn == null || issue.SlaLastNotifiedOn != today)
                             orderby issue.DueAt, issue.Uuid
                             select issue)
            .Take(ScanLimit)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (overdue.Count == 0) return;

        var projectUuids = overdue.Select(issue => issue.ProjectUuid).Distinct().ToList();
        var projectLeads = await db.ProjectMembers.AsNoTracking()
            .Where(member => projectUuids.Contains(member.ProjectUuid) && member.Role == ProjectMemberRole.Lead)
            .GroupBy(member => member.ProjectUuid)
            .ToDictionaryAsync(group => group.Key, group => group.Select(member => member.UserUuid).ToList(), ct)
            .ConfigureAwait(false);

        foreach (var issue in overdue)
        {
            if (!issue.TryMarkSlaReminder(today, now)) continue;

            var recipients = new List<Guid> { issue.ReporterUuid };
            if (issue.AssigneeUuid is { } assignee) recipients.Add(assignee);
            if (projectLeads.TryGetValue(issue.ProjectUuid, out var leads)) recipients.AddRange(leads);

            await publisher.PublishAsync(new UserNotificationRequested(
                recipients,
                ActorId: null,
                Kind: "taskmgmt.issue.sla-overdue",
                SubjectSignature: AggregateSignatures.TaskManagementIssue,
                SubjectUuid: issue.Uuid,
                SubjectKey: issue.Key,
                TitleKey: "shared.notifications.kinds.taskmgmt.issue.sla-overdue",
                Params: new Dictionary<string, string> { ["issueKey"] = issue.Key },
                GroupKey: $"taskmgmt.issue:{issue.Uuid}:sla-overdue",
                Link: $"/task-management/issue/{issue.Key}",
                Severity: NotificationSeverity.Warning,
                CorrelationId: Guid.NewGuid(),
                OccurredAt: now), ct).ConfigureAwait(false);
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
        LogEscalated(_logger, overdue.Count);
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information,
        Message = "Wysłano eskalacje SLA dla {IssueCount} przeterminowanych zgłoszeń.")]
    private static partial void LogEscalated(ILogger logger, int issueCount);

    [LoggerMessage(EventId = 2, Level = LogLevel.Error,
        Message = "Skan eskalacji SLA nie powiódł się; kolejna próba nastąpi w następnym cyklu.")]
    private static partial void LogEscalationFailed(ILogger logger, Exception exception);
}
