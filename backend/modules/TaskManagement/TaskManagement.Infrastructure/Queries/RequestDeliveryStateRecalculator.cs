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

    public RequestDeliveryStateRecalculator(TaskManagementDbContext dbContext) => _dbContext = dbContext;

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

        request.SetDerivedDeliveryState(next, now);
    }
}
