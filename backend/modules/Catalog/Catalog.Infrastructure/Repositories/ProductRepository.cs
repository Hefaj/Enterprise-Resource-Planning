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

    /// <summary>
    /// Kolekcje wewnętrzne agregatu. Dociągane jawnie, bo są mapowane jako zwykłe encje,
    /// a nie typy owned — a zwykłych nawigacji EF sam nie dołącza.
    ///
    /// <para>Pominięcie któregokolwiek wpisu jest groźniejsze, niż wygląda: metody domenowe
    /// w rodzaju <c>SetClassification</c> czy <c>SetCodes</c> podmieniają KOMPLET powiązań,
    /// więc na niewczytanej kolekcji „podmiana” zobaczyłaby pustkę i po cichu dopisała nowe
    /// obok starych, zamiast je zastąpić — przy kodach typów unikalnych kończąc się kolizją
    /// na indeksie. Dlatego wszystkie są tutaj, a nie dobierane per metoda.</para>
    ///
    /// <para>Iloczynu kartezjańskiego nie ma — globalne <c>SplitQuery</c>
    /// (patrz <c>UseErpPostgres</c>) wykonuje osobny SELECT na każdą kolekcję.</para>
    /// </summary>
    private IQueryable<Product> ProductsWithCollections
        => _dbContext.Products
            .Include("_categories")
            .Include("_multimedia")
            .Include("_warranties")
            .Include("_codes")
            .Include("_attributeValues");

    /// <inheritdoc />
    public Task<Product?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => ProductsWithCollections.FirstOrDefaultAsync(p => p.Uuid == uuid, cancellationToken);

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
        return await ProductsWithCollections
            .Where(p => uuidList.Contains(p.Uuid))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public void Add(Product product) => _dbContext.Products.Add(product);
}
