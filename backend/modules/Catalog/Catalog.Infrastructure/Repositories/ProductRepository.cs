using Catalog.Application.Abstractions;
using Catalog.Domain.Products;
using Catalog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Repositories;

/// <summary>Repozytorium produktów oparte na EF Core.</summary>
public sealed class ProductRepository : IProductRepository
{
    private readonly CatalogDbContext _dbContext;

    /// <summary>
    /// Produkty wciągnięte do kontekstu przez <see cref="PreloadAsync"/> — trzymamy je osobno,
    /// zamiast ufać samej obecności w ChangeTrackerze, bo o tym, czy wpis wolno oddać bez
    /// zapytania, decyduje ZAKRES, w jakim go wczytano, a tej informacji EF nie przechowuje.
    /// </summary>
    private readonly HashSet<Guid> _preloaded = [];

    /// <summary>Zakres, w jakim wczytano wpisy z <see cref="_preloaded"/>.</summary>
    private ProductLoadScope _preloadedScope = ProductLoadScope.Full;

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
    /// <para>Z tego samego powodu <see cref="ProductLoadScope.Root"/> jest osobnym, jawnym
    /// zakresem, a nie domyślnym zachowaniem: zawężenie wczytania musi być decyzją handlera,
    /// który wie, że jego metoda domenowa kolekcji nie dotyka.</para>
    ///
    /// <para>Iloczynu kartezjańskiego nie ma — globalne <c>SplitQuery</c>
    /// (patrz <c>UseErpPostgres</c>) wykonuje osobny SELECT na każdą kolekcję. To ten sam
    /// mechanizm, przez który pełne wczytanie kosztuje sześć zapytań zamiast jednego.</para>
    /// </summary>
    private IQueryable<Product> ProductsWithCollections
        => _dbContext.Products
            .Include("_categories")
            .Include("_multimedia")
            .Include("_warranties")
            .Include("_codes")
            .Include("_attributeValues");

    private IQueryable<Product> QueryFor(ProductLoadScope scope)
        => scope == ProductLoadScope.Full ? ProductsWithCollections : _dbContext.Products;

    /// <inheritdoc />
    public Task<Product?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => FindAsync(uuid, ProductLoadScope.Full, cancellationToken);

    /// <inheritdoc />
    public async Task<Product?> FindAsync(Guid uuid, ProductLoadScope scope, CancellationToken cancellationToken)
    {
        // Z pamięci kontekstu serwujemy wyłącznie wtedy, gdy wczytanie z góry objęło CO NAJMNIEJ
        // tyle, ile obiecuje żądany zakres. Oddanie produktu wczytanego jako sam korzeń metodzie
        // podmieniającej kolekcję byłoby cichą utratą powiązań — dlatego przy zbyt wąskim
        // preloadzie schodzimy niżej, do zwykłego zapytania. EF dociągnie wtedy brakujące
        // nawigacje do już śledzonego wpisu, więc kosztuje to zapytanie, a nie poprawność.
        if (_preloadedScope >= scope && _preloaded.Contains(uuid))
        {
            // Wpis jest w identity mapie kontekstu (wstawił go tam preload), więc `FindAsync`
            // oddaje go bez odpytywania bazy.
            return await _dbContext.Products.FindAsync([uuid], cancellationToken).ConfigureAwait(false);
        }

        return await QueryFor(scope)
            .FirstOrDefaultAsync(p => p.Uuid == uuid, cancellationToken)
            .ConfigureAwait(false);
    }

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

        var uuidList = uuids as List<Guid> ?? [.. uuids];
        return await ProductsWithCollections
            .Where(p => uuidList.Contains(p.Uuid))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task PreloadAsync(
        IReadOnlyCollection<Guid> uuids,
        ProductLoadScope scope,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(uuids);

        if (uuids.Count == 0)
        {
            return;
        }

        var uuidList = uuids as List<Guid> ?? [.. uuids];

        var loaded = await QueryFor(scope)
            .Where(p => uuidList.Contains(p.Uuid))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // Przy kolejnym wczytaniu w tym samym scope obowiązuje zakres WĘŻSZY z dwóch —
        // obietnica repozytorium nie może być szersza niż to, co faktycznie jest w pamięci.
        // W praktyce runner woła to raz na chunk, ale zasada musi być odporna na drugie wywołanie.
        _preloadedScope = _preloaded.Count == 0
            ? scope
            : (ProductLoadScope)Math.Min((int)_preloadedScope, (int)scope);

        // Zapisujemy wyłącznie produkty, które FAKTYCZNIE się wczytały. Uuid nieistniejący
        // w bazie musi trafić do zwykłego zapytania i wrócić jako `null`, a nie zostać uznany
        // za „wczytany, tylko nieobecny w identity mapie”.
        foreach (var product in loaded)
        {
            _preloaded.Add(product.Uuid);
        }
    }

    /// <inheritdoc />
    public void Add(Product product) => _dbContext.Products.Add(product);
}
