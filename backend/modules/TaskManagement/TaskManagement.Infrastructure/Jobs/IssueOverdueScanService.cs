using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Jobs;

/// <summary>
/// Skan terminów zgłoszeń (faza 5, REQ-005) — zbliżający się i miniony termin, po zgłoszeniach
/// jeszcze nieotwartych w kategorii <c>Done</c>. Idzie po filtrowanym indeksie
/// <c>(due_at) WHERE state_category &lt;&gt; Done</c> (patrz <c>IssueConfiguration</c>).
///
/// <para>Publikuje <c>taskmgmt.issue.due_soon</c>/<c>overdue</c> (<c>UserNotificationRequested</c>,
/// NTF-002) do obserwujących i przypisanego, bez sprawcy — skan nie ma sprawcy. Grupowane po
/// zgłoszeniu (<see cref="IssueNotificationPublisher.PublishDueAsync"/>), więc powtórne
/// przypomnienie tego samego terminu po <see cref="MinRenotifyInterval"/> inkrementuje istniejący
/// wpis zamiast zasypywać feed kolejnymi.</para>
/// </summary>
[ClusterSafe("Dzierżawa taskmgmt:issue-overdue-scan na advisory locku Postgresa — bez niej dwie "
    + "instancje wysłałyby dwa powiadomienia o tym samym terminie.")]
public sealed partial class IssueOverdueScanService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    /// <summary>Okno „zbliżający się termin" — zgłoszenie wpada w skan jeden raz w tym oknie
    /// przed terminem, dzięki <see cref="MinRenotifyInterval"/>.</summary>
    private static readonly TimeSpan DueSoonWindow = TimeSpan.FromHours(24);

    /// <summary>Minimalny odstęp między dwoma powiadomieniami o tym samym zgłoszeniu — jeden
    /// tick skanu (15 minut) nie ma prawa wygenerować drugiego powiadomienia o tym samym
    /// terminie.</summary>
    private static readonly TimeSpan MinRenotifyInterval = TimeSpan.FromHours(12);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<IssueOverdueScanService> _logger;

    public IssueOverdueScanService(IServiceScopeFactory scopeFactory, ILogger<IssueOverdueScanService> logger)
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
                await ScanOnceAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogScanFailed(_logger, ex);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    private async Task ScanOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();

        var lease = scope.ServiceProvider.GetRequiredService<IExclusiveLease>();
        await using var held = await lease.TryAcquireAsync("taskmgmt:issue-overdue-scan", ct).ConfigureAwait(false);

        if (held is null)
        {
            return;
        }

        var dbContext = scope.ServiceProvider.GetRequiredService<TaskManagementDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var notifications = scope.ServiceProvider.GetRequiredService<IssueNotificationPublisher>();

        var now = clock.UtcNow;
        var dueSoonHorizon = now.Add(DueSoonWindow);
        var renotifyCutoff = now.Subtract(MinRenotifyInterval);

        var candidates = await dbContext.Issues
            .Include(i => i.Watchers)
            .Where(i => i.StateCategory != WorkflowStateCategory.Done
                && i.DueAt != null
                && i.DueAt <= dueSoonHorizon
                && (i.LastOverdueNotifiedAt == null || i.LastOverdueNotifiedAt <= renotifyCutoff))
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (candidates.Count == 0)
        {
            return;
        }

        foreach (var issue in candidates)
        {
            var overdue = issue.DueAt <= now;
            issue.MarkOverdueNotified(now);

            await notifications
                .PublishDueAsync(issue, overdue, now, Guid.CreateVersion7(), ct)
                .ConfigureAwait(false);
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        LogScanCompleted(_logger, candidates.Count);
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Skan terminów: oznaczono {Count} zgłoszeń.")]
    private static partial void LogScanCompleted(ILogger logger, int count);

    [LoggerMessage(EventId = 2, Level = LogLevel.Error, Message = "Skan terminów nie powiódł się w tym cyklu — spróbuję ponownie za 15 minut.")]
    private static partial void LogScanFailed(ILogger logger, Exception ex);
}
