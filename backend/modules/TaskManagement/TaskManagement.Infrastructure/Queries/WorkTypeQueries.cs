using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.WorkTypes;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyty rodzajów pracy — globalne plus, gdy podano projekt, jego własne
/// (TIME-001 AC2), wzorem <c>TagQueries</c>.</summary>
public sealed class WorkTypeQueries : IWorkTypeQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public WorkTypeQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<List<WorkTypeDto>> SearchAsync(SearchWorkTypeRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.WorkTypes.AsNoTracking().Where(t => t.ProjectUuid == null);

        if (request.ProjectUuid is { } projectUuid)
        {
            query = _dbContext.WorkTypes.AsNoTracking()
                .Where(t => t.ProjectUuid == null || t.ProjectUuid == projectUuid);
        }

        return query
            .OrderBy(t => t.Name)
            .Select(t => new WorkTypeDto(t.Uuid, t.ProjectUuid, t.Name))
            .ToListAsync(cancellationToken);
    }
}
