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

    /// <inheritdoc />
    public async Task<List<string>> GetExistingCodesAsync(
        IReadOnlyCollection<string> codes,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(codes);

        if (codes.Count == 0)
        {
            return [];
        }

        var codeList = codes as List<string> ?? codes.ToList();

        return await _dbContext.PermissionCatalogEntries
            .AsNoTracking()
            .Where(p => codeList.Contains(p.Code) && !p.IsObsolete)
            .Select(p => p.Code)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
