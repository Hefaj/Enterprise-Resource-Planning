using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Resolutions;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyty rozwiązań — systemowe plus, gdy podano projekt, jego własne (ISS-007).</summary>
public sealed class ResolutionQueries : IResolutionQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public ResolutionQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<List<ResolutionDto>> SearchAsync(SearchResolutionRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.Resolutions.AsNoTracking().Where(r => r.ProjectUuid == null);

        if (request.ProjectUuid is { } projectUuid)
        {
            query = _dbContext.Resolutions.AsNoTracking()
                .Where(r => r.ProjectUuid == null || r.ProjectUuid == projectUuid);
        }

        return query
            .OrderBy(r => r.OrderNo)
            .Select(r => new ResolutionDto(r.Uuid, r.ProjectUuid, r.Name, r.NameKey, r.IsSystem, r.OrderNo))
            .ToListAsync(cancellationToken);
    }
}
