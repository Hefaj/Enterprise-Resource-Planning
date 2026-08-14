using Catalog.Application.Abstractions;
using Catalog.Domain.Products;
using Catalog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Repositories;

/// <summary>Repozytorium produktów oparte na EF Core.</summary>
public sealed class ProductRepository : IProductRepository
{
    private readonly CatalogDbContext _dbContext;

    public ProductRepository(CatalogDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public Task<Product?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.Products.FirstOrDefaultAsync(p => p.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public async Task<List<Product>> FindManyAsync(
        IReadOnlyCollection<Guid> uuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(uuids);

        if (uuids.Count == 0)
        {
            return [];
        }

        var uuidList = uuids.ToList();
        return await _dbContext.Products
            .Where(p => uuidList.Contains(p.Uuid))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public void Add(Product product) => _dbContext.Products.Add(product);
}
