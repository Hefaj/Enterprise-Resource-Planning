using Catalog.Application.Abstractions;
using Catalog.Domain.Multimedia;
using Catalog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Repositories;

/// <summary>Repozytorium zasobów multimedialnych oparte na EF Core.</summary>
public sealed class MultimediaRepository : IMultimediaRepository
{
    private readonly CatalogDbContext _dbContext;

    public MultimediaRepository(CatalogDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public void Add(MultimediaAsset asset) => _dbContext.MultimediaAssets.Add(asset);

    /// <inheritdoc />
    public async Task<MultimediaAsset?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => await _dbContext.MultimediaAssets
            .FirstOrDefaultAsync(m => m.Uuid == uuid, cancellationToken)
            .ConfigureAwait(false);

    /// <inheritdoc />
    public async Task<List<MultimediaAsset>> FindManyAsync(
        IReadOnlyCollection<Guid> uuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(uuids);

        if (uuids.Count == 0)
        {
            return [];
        }

        var uuidList = uuids as List<Guid> ?? [.. uuids];

        return await _dbContext.MultimediaAssets
            .Where(m => uuidList.Contains(m.Uuid))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public void Remove(MultimediaAsset asset) => _dbContext.MultimediaAssets.Remove(asset);
}
