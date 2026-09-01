using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <inheritdoc cref="IIssueDeliveryQueries"/>
public sealed class IssueDeliveryQueries : IIssueDeliveryQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueDeliveryQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<Guid?> FindRequestForExecutionAsync(Guid executionIssueUuid, CancellationToken cancellationToken)
        => _dbContext.IssueLinks
            .AsNoTracking()
            .Where(l => l.SourceUuid == executionIssueUuid && l.Type == IssueLinkType.Delivers)
            .Select(l => (Guid?)l.TargetUuid)
            .FirstOrDefaultAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<bool> AllDeliveriesClosedAsync(Guid requestIssueUuid, CancellationToken cancellationToken)
    {
        var categories = await (
                from link in _dbContext.IssueLinks.AsNoTracking()
                where link.TargetUuid == requestIssueUuid && link.Type == IssueLinkType.Delivers
                join execution in _dbContext.Issues.AsNoTracking() on link.SourceUuid equals execution.Uuid
                select execution.StateCategory)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // Zlecenie bez żadnej realizacji nie jest zrealizowane — pusta lista nie może dać `true`.
        return categories.Count > 0 && categories.TrueForAll(category => category == WorkflowStateCategory.Done);
    }
}
