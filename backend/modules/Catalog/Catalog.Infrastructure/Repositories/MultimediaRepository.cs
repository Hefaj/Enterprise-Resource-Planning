using Catalog.Application.Abstractions;
using Catalog.Domain.Multimedia;
using Catalog.Infrastructure.Persistence;

namespace Catalog.Infrastructure.Repositories;

/// <summary>Repozytorium zasobów multimedialnych oparte na EF Core.</summary>
public sealed class MultimediaRepository : IMultimediaRepository
{
    private readonly CatalogDbContext _dbContext;

    public MultimediaRepository(CatalogDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public void Add(MultimediaAsset asset) => _dbContext.MultimediaAssets.Add(asset);
}
