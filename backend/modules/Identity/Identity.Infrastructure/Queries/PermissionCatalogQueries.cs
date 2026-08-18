using Identity.Application.Permissions;
using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Identity.Infrastructure.Queries;

public sealed class PermissionCatalogQueries : IPermissionCatalogQueries
{
    private readonly IdentityDbContext _dbContext;

    public PermissionCatalogQueries(IdentityDbContext dbContext) => _dbContext = dbContext;

    public async Task<List<PermissionCatalogEntryDto>> GetAllAsync(CancellationToken cancellationToken)
        => await _dbContext.PermissionCatalogEntries
            .AsNoTracking()
            .OrderBy(p => p.Module)
            .ThenBy(p => p.Resource)
            .ThenBy(p => p.Action)
            .Select(p => new PermissionCatalogEntryDto(p.Code, p.Module, p.Resource, p.Action, p.DescriptionKey, p.IsObsolete))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
}
