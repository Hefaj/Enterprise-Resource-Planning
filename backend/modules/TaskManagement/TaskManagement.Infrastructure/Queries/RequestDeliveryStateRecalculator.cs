using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Projekcja postępu wykonania dla zleceń <see cref="ProjectKind.Intake"/>.</summary>
public sealed class RequestDeliveryStateRecalculator : IRequestDeliveryStateRecalculator
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IIntegrationEventPublisher _publisher;

    public RequestDeliveryStateRecalculator(TaskManagementDbContext dbContext, IIntegrationEventPublisher publisher)
        => (_dbContext, _publisher) = (dbContext, publisher);

    public async Task RecalculateForDeliveryAsync(
        Guid deliveryIssueUuid,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var removedLinkUuids = _dbContext.ChangeTracker.Entries<IssueLink>()
            .Where(entry => entry.State == EntityState.Deleted)
            .Select(entry => entry.Entity.Uuid)
            .ToHashSet();

        var requestUuids = await _dbContext.IssueLinks
            .AsNoTracking()
            .Where(link => link.SourceUuid == deliveryIssueUuid
                && link.Type == IssueLinkType.Delivers
                && !removedLinkUuids.Contains(link.Uuid))
            .Select(link => link.TargetUuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        requestUuids.AddRange(_dbContext.ChangeTracker.Entries<IssueLink>()
            .Where(entry => entry.State == EntityState.Added
                && entry.Entity.SourceUuid == deliveryIssueUuid
                && entry.Entity.Type == IssueLinkType.Delivers)
            .Select(entry => entry.Entity.TargetUuid));

        foreach (var requestUuid in requestUuids)
        {
            await RecalculateRequestAsync(requestUuid, now, cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task RecalculateRequestAsync(
        Guid requestUuid,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var request = await _dbContext.Issues
            .FirstOrDefaultAsync(issue => issue.Uuid == requestUuid, cancellationToken)
            .ConfigureAwait(false);

        if (request is null)
        {
            return;
        }

        var isIntake = await _dbContext.Projects
            .AsNoTracking()
            .AnyAsync(project => project.Uuid == request.ProjectUuid && project.Kind == ProjectKind.Intake, cancellationToken)
            .ConfigureAwait(false);

        if (!isIntake)
        {
            return;
        }

        var removedLinkUuids = _dbContext.ChangeTracker.Entries<IssueLink>()
            .Where(entry => entry.State == EntityState.Deleted)
            .Select(entry => entry.Entity.Uuid)
            .ToHashSet();

        var categories = await (
                from link in _dbContext.IssueLinks.AsNoTracking()
                join delivery in _dbContext.Issues.AsNoTracking() on link.SourceUuid equals delivery.Uuid
                join state in _dbContext.WorkflowStates.AsNoTracking() on delivery.StateUuid equals state.Uuid
                where link.TargetUuid == requestUuid
                    && link.Type == IssueLinkType.Delivers
                    && !removedLinkUuids.Contains(link.Uuid)
                select state.Category)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var pendingDeliveryUuids = _dbContext.ChangeTracker.Entries<IssueLink>()
            .Where(entry => entry.State == EntityState.Added
                && entry.Entity.TargetUuid == requestUuid
                && entry.Entity.Type == IssueLinkType.Delivers)
            .Select(entry => entry.Entity.SourceUuid)
            .ToHashSet();

        if (pendingDeliveryUuids.Count > 0)
        {
            var pendingCategories = await (
                    from delivery in _dbContext.Issues
                    join state in _dbContext.WorkflowStates on delivery.StateUuid equals state.Uuid
                    where pendingDeliveryUuids.Contains(delivery.Uuid)
                    select state.Category)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            categories.AddRange(pendingCategories);
        }

        // Brak realizacji = brak postępu, a nie "do zrobienia". "Todo" znaczy, że istnieje
        // już konkretna realizacja, ale nikt jej jeszcze nie rozpoczął.
        WorkflowStateCategory? next = categories.Count switch
        {
            0 => null,
            _ when categories.All(category => category == WorkflowStateCategory.Done) => WorkflowStateCategory.Done,
            _ when categories.Any(category => category == WorkflowStateCategory.InProgress) => WorkflowStateCategory.InProgress,
            _ => WorkflowStateCategory.Todo,
        };

        var previous = request.DerivedDeliveryState;
        request.SetDerivedDeliveryState(next, now);

        // Moment, na który czeka zamawiający: ostatnia realizacja właśnie wpadła w `Done`.
        // Powiadomienie idzie STĄD, a nie z komendy zmiany stanu realizacji, bo dopiero tutaj
        // wiadomo, że domknęła się CAŁA lista realizacji, a nie jedna z nich
        // (`docs/backend/task-management.md` §9.2).
        if (previous != WorkflowStateCategory.Done && next == WorkflowStateCategory.Done)
        {
            await NotifyRequestDeliveredAsync(request, now, cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// „Zlecenie zrealizowane" do zamawiającego. Odbiorcami są zgłaszający, przypisany
    /// i obserwujący zlecenie — czyli ci, którzy o nie pytają; wykonawcy wiedzą bez powiadomienia,
    /// bo to oni właśnie skończyli.
    /// </summary>
    private async Task NotifyRequestDeliveredAsync(Issue request, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var recipients = new List<Guid> { request.ReporterUuid };

        if (request.AssigneeUuid is { } assignee)
        {
            recipients.Add(assignee);
        }

        recipients.AddRange(request.Watchers);
        recipients = [.. recipients.Where(uuid => uuid != Guid.Empty).Distinct()];

        if (recipients.Count == 0)
        {
            return;
        }

        await _publisher.PublishAsync(new UserNotificationRequested(
            recipients,
            ActorId: null,
            Kind: "taskmgmt.issue.request-delivered",
            SubjectSignature: AggregateSignatures.TaskManagementIssue,
            SubjectUuid: request.Uuid,
            SubjectKey: request.Key,
            TitleKey: "shared.notifications.kinds.taskmgmt.issue.request-delivered",
            Params: new Dictionary<string, string> { ["issueKey"] = request.Key },
            GroupKey: $"taskmgmt.issue:{request.Uuid}:delivery",
            Link: $"/task-management/issue/{request.Key}",
            Severity: NotificationSeverity.Info,
            CorrelationId: Guid.NewGuid(),
            OccurredAt: now), cancellationToken).ConfigureAwait(false);
    }
}
