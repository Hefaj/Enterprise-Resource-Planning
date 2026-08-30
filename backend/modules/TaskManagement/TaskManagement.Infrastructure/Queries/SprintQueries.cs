using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Sprints;
using TaskManagement.Domain.Sprints;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

public sealed class SprintQueries : ISprintQueries
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;
    public SprintQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext) => (_dbContext, _executionContext) = (dbContext, executionContext);

    public async Task<SearchResponse> SearchAsync(SearchSprintRequest request, CancellationToken cancellationToken)
    {
        var query = Visible(request);
        var total = await query.CountAsync(cancellationToken).ConfigureAwait(false);
        var uuids = await query.OrderByDescending(s => s.StartOn).ThenBy(s => s.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize).Take(request.PageSize)
            .Select(s => s.Uuid).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new SearchResponse { Uuids = uuids, TotalCount = total };
    }

    public Task<List<Guid>> GetMatchingUuidsAsync(SearchSprintRequest request, CancellationToken cancellationToken)
        => Visible(request).OrderBy(s => s.Uuid).Select(s => s.Uuid).ToListAsync(cancellationToken);

    public async Task<List<SprintDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken)
    {
        var query = Visible(new SearchSprintRequest());
        if (uuids is { Count: > 0 }) query = query.Where(s => uuids.Contains(s.Uuid));
        return await query.OrderByDescending(s => s.StartOn).ThenBy(s => s.Uuid)
            .Select(s => new SprintDto(s.Uuid, s.BoardUuid, s.Name, s.StartOn, s.EndOn, s.Status))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    private IQueryable<Sprint> Visible(SearchSprintRequest request)
    {
        var me = IssueVisibility.CurrentUser(_executionContext);
        var query = _dbContext.Sprints.AsNoTracking().Where(s => _dbContext.Boards
            .Where(b => b.Uuid == s.BoardUuid)
            .Any(b => _dbContext.Projects.VisibleTo(_dbContext, me).Any(p => p.Uuid == b.ProjectUuid)));
        return request.BoardUuid is { } boardUuid ? query.Where(s => s.BoardUuid == boardUuid) : query;
    }
}
