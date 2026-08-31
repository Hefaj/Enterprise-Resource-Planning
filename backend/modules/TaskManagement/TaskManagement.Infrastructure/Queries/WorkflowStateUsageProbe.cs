using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

public sealed class WorkflowStateUsageProbe : IWorkflowStateUsageProbe
{
    private readonly TaskManagementDbContext _db;
    public WorkflowStateUsageProbe(TaskManagementDbContext db) => _db = db;
    public async Task<IReadOnlyCollection<Guid>> GetUsedStateUuidsAsync(Guid schemeUuid, CancellationToken cancellationToken)
        => await (from issue in _db.Issues.AsNoTracking()
                  join project in _db.Projects.AsNoTracking() on issue.ProjectUuid equals project.Uuid
                  where project.WorkflowSchemeUuid == schemeUuid
                  select issue.StateUuid).Distinct().ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<IReadOnlyCollection<Guid>> GetUsedStateUuidsInProjectAsync(Guid projectUuid, CancellationToken cancellationToken)
        => await _db.Issues.AsNoTracking()
            .Where(issue => issue.ProjectUuid == projectUuid)
            .Select(issue => issue.StateUuid)
            .Distinct()
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    public async Task<IReadOnlyCollection<Guid>> GetIssueUuidsInStateAsync(Guid schemeUuid, Guid stateUuid, CancellationToken cancellationToken)
        => await (from issue in _db.Issues.AsNoTracking()
                  join project in _db.Projects.AsNoTracking() on issue.ProjectUuid equals project.Uuid
                  where project.WorkflowSchemeUuid == schemeUuid && issue.StateUuid == stateUuid
                  select issue.Uuid).ToListAsync(cancellationToken).ConfigureAwait(false);
}
