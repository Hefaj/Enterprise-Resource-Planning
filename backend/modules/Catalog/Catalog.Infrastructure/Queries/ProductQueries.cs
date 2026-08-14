using Catalog.Application.Contracts;
using Catalog.Domain.Products;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Api.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Queries;

/// <summary>Odczyty produktów realizowane bezpośrednio na EF Core.</summary>
public sealed class ProductQueries : IProductQueries
{
    private readonly CatalogDbContext _dbContext;

    public ProductQueries(CatalogDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(
        SearchProductRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = await ApplyFiltersAsync(request, cancellationToken).ConfigureAwait(false);

        // Liczymy PRZED stronicowaniem — totalCount opisuje cały zbiór wyników, nie stronę.
        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await ApplySorting(query, request)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(p => p.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<Guid>> GetMatchingUuidsAsync(
        SearchProductRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = await ApplyFiltersAsync(request, cancellationToken).ConfigureAwait(false);

        // Bez stronicowania — operacja masowa obejmuje cały zbiór pasujący do filtra.
        return await query
            .OrderBy(p => p.Uuid)
            .Select(p => p.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<List<Guid>> GetExistingUuidsAsync(
        IReadOnlyCollection<Guid> uuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(uuids);

        if (uuids.Count == 0)
        {
            return [];
        }

        var uuidList = uuids as List<Guid> ?? uuids.ToList();

        return await _dbContext.Products
            .AsNoTracking()
            .Where(p => uuidList.Contains(p.Uuid))
            .Select(p => p.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<List<ProductDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Products.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(p => uuidList.Contains(p.Uuid));
        }

        // Projekcja wprost do DTO: EF generuje JOIN-y do tabel powiązań i składa listy
        // po stronie bazy, bez materializowania agregatów Product w pamięci.
        return await query
            .Select(p => new ProductDto(
                p.Uuid,
                p.Name,
                EF.Property<List<ProductCategoryLink>>(p, "_categories")
                    .Select(l => l.CategoryUuid).ToList(),
                EF.Property<List<ProductMultimediaLink>>(p, "_multimedia")
                    .Select(l => l.MultimediaUuid).ToList(),
                EF.Property<List<ProductWarranty>>(p, "_warranties")
                    .Select(w => new ProductWarrantyDto(w.WarrantyUuid, w.DurationMonths)).ToList(),
                p.ModelUuid,
                p.Sku,
                p.Price,
                p.AvailableFrom == null ? null : p.AvailableFrom.Value.UtcDateTime,
                p.Status == ProductStatus.Active ? ProductStatusNames.Active : ProductStatusNames.Draft,
                p.Status == ProductStatus.Active,
                p.Ean,
                p.Image,
                p.AttrWeight,
                p.AttrColor))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>
    /// Buduje zapytanie z nałożonymi filtrami.
    ///
    /// Asynchroniczne, bo filtr po zaznaczeniu drzewa kategorii wymaga wcześniejszego
    /// rozwiązania zaznaczenia na zbiór identyfikatorów — patrz
    /// <see cref="ResolveSelectedCategoryUuidsAsync"/>.
    /// </summary>
    private async Task<IQueryable<Product>> ApplyFiltersAsync(
        SearchProductRequest request,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Products.AsNoTracking();

        if (request.ProductId.HasValue)
        {
            query = query.Where(p => p.Uuid == request.ProductId.Value);
        }

        if (request.ModelId.HasValue)
        {
            query = query.Where(p => p.ModelUuid == request.ModelId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.ProductCode))
        {
            var code = request.ProductCode;
            // ILIKE — dopasowanie bez uwzględniania wielkości liter po stronie Postgresa.
            query = query.Where(p => EF.Functions.ILike(p.Sku, $"%{code}%")
                                  || EF.Functions.ILike(p.Ean, $"%{code}%"));
        }

        if (request.Category is not null && !request.Category.IsEmpty)
        {
            var categoryUuids = await ResolveSelectedCategoryUuidsAsync(request.Category, cancellationToken)
                .ConfigureAwait(false);

            // Przez nawigację właściciela, nie przez `Set<ProductCategoryLink>()`: typ owned
            // nie ma własnego DbSet i EF odrzuca próbę odpytania go samodzielnie.
            query = query.Where(p => EF.Property<List<ProductCategoryLink>>(p, "_categories")
                .Any(l => categoryUuids.Contains(l.CategoryUuid)));
        }

        return query;
    }

    /// <summary>
    /// Rozwija zaznaczenie drzewa (<see cref="TreeSelectionRequest"/>) na zbiór identyfikatorów kategorii.
    ///
    /// Realizowane przez tabelę domknięcia, a nie przez <c>TreeSelectionResolver</c> w pamięci:
    /// wersja in-memory wymagała wczytania mapy dziecko→rodzic dla CAŁEGO drzewa przy każdym
    /// zapytaniu, co przy setkach tysięcy kategorii jest nie do utrzymania. Semantyka
    /// pozostaje ta sama — poddrzewa z korzeni, minus wykluczenia, plus jawnie zaznaczone węzły,
    /// przy czym jawne zaznaczenie wygrywa z wykluczeniem.
    /// </summary>
    private async Task<List<Guid>> ResolveSelectedCategoryUuidsAsync(
        TreeSelectionRequest selection,
        CancellationToken cancellationToken)
    {
        var included = new HashSet<Guid>(selection.Ids);

        if (selection.SubtreeRoots.Count > 0)
        {
            // Odległość każdego węzła do NAJBLIŻSZEGO zaznaczonego korzenia i do najbliższego
            // wykluczenia. Same zbiory identyfikatorów nie wystarczą — o przynależności
            // rozstrzyga to, który znacznik leży bliżej na ścieżce do korzenia.
            var nearestRootDepth = await MinDepthByDescendantAsync(
                selection.SubtreeRoots, cancellationToken).ConfigureAwait(false);

            var nearestExcludedDepth = selection.Excluded.Count > 0
                ? await MinDepthByDescendantAsync(selection.Excluded, cancellationToken).ConfigureAwait(false)
                : [];

            var excludedSet = new HashSet<Guid>(selection.Excluded);

            foreach (var (uuid, rootDepth) in nearestRootDepth)
            {
                if (selection.Ids.Contains(uuid))
                {
                    // Reguła 1: jawne zaznaczenie wygrywa ze wszystkim.
                    included.Add(uuid);
                    continue;
                }

                // Reguła 2 (sam węzeł): wykluczenie rozstrzyga PRZED korzeniem poddrzewa.
                // To ono realizuje wzorzec „poddrzewo X bez samego X”.
                if (excludedSet.Contains(uuid))
                {
                    continue;
                }

                // Reguła 3 (przodkowie): bliższy znacznik wygrywa, a przy równej odległości
                // pierwszeństwo ma korzeń poddrzewa. Dzięki temu potomek węzła z wzorca
                // „X bez samego X” trafia na X jako korzeń i zostaje włączony, mimo że
                // ten sam X jest dla siebie wykluczeniem.
                if (!nearestExcludedDepth.TryGetValue(uuid, out var excludedDepth)
                    || rootDepth <= excludedDepth)
                {
                    included.Add(uuid);
                }
            }
        }

        return [.. included];
    }

    /// <summary>
    /// Dla każdego potomka podanych węzłów zwraca odległość do najbliższego z nich.
    ///
    /// Uwaga na skalę: zaznaczenie korzenia bardzo dużego poddrzewa materializuje tu wszystkie
    /// jego identyfikatory. Przy obecnych rozmiarach drzewa jest to akceptowalne, ale gdyby
    /// filtr po kategoriach zaczął być używany na gałęzi syntetycznej w profilu `Stress`,
    /// trzeba to przenieść do jednego zapytania SQL z <c>EXISTS</c> po tabeli domknięcia,
    /// zamiast przenosić zbiór identyfikatorów przez granicę procesu.
    /// </summary>
    private async Task<Dictionary<Guid, int>> MinDepthByDescendantAsync(
        List<Guid> ancestors,
        CancellationToken cancellationToken)
    {
        var rows = await _dbContext.CategoryClosure
            .AsNoTracking()
            .Where(e => ancestors.Contains(e.AncestorUuid))
            .GroupBy(e => e.DescendantUuid)
            .Select(g => new { Uuid = g.Key, Depth = g.Min(e => e.Depth) })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return rows.ToDictionary(r => r.Uuid, r => r.Depth);
    }

    /// <summary>
    /// Sortowanie po polach dopuszczonych przez kontrakt.
    ///
    /// Whitelist zamiast dynamicznego budowania wyrażenia z nazwy pola jest świadoma:
    /// nazwa pola przychodzi z żądania HTTP, a przepuszczenie jej wprost do zapytania
    /// otwiera drogę do sortowania po kolumnach, których API nie zamierzało wystawiać.
    /// </summary>
    private static IQueryable<Product> ApplySorting(IQueryable<Product> query, SearchProductRequest request)
    {
        if (request.Sorts is null || request.Sorts.Count == 0)
        {
            // Stabilna kolejność domyślna — bez niej stronicowanie potrafi zwracać
            // ten sam wiersz na dwóch stronach, bo Postgres nie gwarantuje kolejności.
            return query.OrderBy(p => p.Uuid);
        }

        IOrderedQueryable<Product>? ordered = null;

        foreach (var sort in request.Sorts)
        {
            var descending = sort.Order == -1;

            ordered = sort.Field.ToUpperInvariant() switch
            {
                "SKU" => Chain(ordered, query, p => p.Sku, descending),
                "NAME" => Chain(ordered, query, p => p.Name, descending),
                "PRICE" => Chain(ordered, query, p => p.Price, descending),
                "AVAILABLEFROM" => Chain(ordered, query, p => p.AvailableFrom, descending),
                "STATUS" => Chain(ordered, query, p => p.Status, descending),
                "AVAILABLE" => Chain(ordered, query, p => p.Status, descending),
                _ => ordered,
            };
        }

        // Domknięcie stabilnym kluczem — dwa produkty o tej samej cenie muszą mieć
        // powtarzalną kolejność między kolejnymi stronami.
        return ordered is null ? query.OrderBy(p => p.Uuid) : ordered.ThenBy(p => p.Uuid);
    }

    private static IOrderedQueryable<Product> Chain<TKey>(
        IOrderedQueryable<Product>? ordered,
        IQueryable<Product> query,
        System.Linq.Expressions.Expression<Func<Product, TKey>> selector,
        bool descending)
    {
        if (ordered is null)
        {
            return descending ? query.OrderByDescending(selector) : query.OrderBy(selector);
        }

        return descending ? ordered.ThenByDescending(selector) : ordered.ThenBy(selector);
    }
}
