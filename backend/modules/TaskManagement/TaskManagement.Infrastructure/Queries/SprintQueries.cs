using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Sprints;
using TaskManagement.Domain.Sprints;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyty sprintów — widoczność dziedziczy po projekcie tablicy, jak <see cref="BoardQueries"/>.</summary>
public sealed class SprintQueries : ISprintQueries
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public SprintQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task<List<SprintDto>> SearchAsync(SearchSprintRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = Visible();

        if (request.BoardUuid is { } boardUuid)
        {
            query = query.Where(s => s.BoardUuid == boardUuid);
        }

        if (request.Status is { } status)
        {
            query = query.Where(s => s.Status == status);
        }

        return await Project(query.OrderBy(s => s.StartsOn).ThenBy(s => s.Name))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public Task<SprintDto?> GetAsync(Guid uuid, CancellationToken cancellationToken)
        => Project(Visible().Where(s => s.Uuid == uuid)).FirstOrDefaultAsync(cancellationToken);

    private IQueryable<Sprint> Visible()
    {
        var userUuid = IssueVisibility.CurrentUser(_executionContext);

        return _dbContext.Sprints
            .AsNoTracking()
            .Where(s => _dbContext.Boards
                .Where(b => b.Uuid == s.BoardUuid)
                .Any(b => _dbContext.Projects.VisibleTo(_dbContext, userUuid).Any(p => p.Uuid == b.ProjectUuid)));
    }

    private static IQueryable<SprintDto> Project(IQueryable<Sprint> sprints)
        => sprints.Select(s => new SprintDto(
            s.Uuid,
            s.BoardUuid,
            s.Name,
            s.Goal,
            s.StartsOn,
            s.EndsOn,
            s.Status,
            s.ActivatedAt,
            s.ClosedAt));
}
