using Catalog.Application.Contracts;
using Catalog.Domain.Categories;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Api.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Queries;

/// <summary>
/// Odczyty kategorii, łącznie z widokami drzewiastymi.
///
/// Metadane hierarchii (<c>childCount</c>, <c>descendantCount</c>) liczy tabela domknięcia
/// zamiast rekurencji po <c>ParentUuid</c>. Poprzednia wersja robiła to w pamięci
/// (<c>CategoryTreeNodeMapper.CountDescendants</c>) i przy pełnym drzewie jedno stronicowane
/// zapytanie kosztowało ponad 9 sekund.
/// </summary>
public sealed class CategoryQueries : ICategoryQueries
{
    private readonly CatalogDbContext _dbContext;

    public CategoryQueries(CatalogDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(
        SearchCategoryRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.Categories.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var name = request.Name;
            query = query.Where(c => EF.Functions.ILike(c.Name, $"%{name}%"));
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var descending = request.Sorts?.FirstOrDefault()?.Order == -1;
        var ordered = descending ? query.OrderByDescending(c => c.Name) : query.OrderBy(c => c.Name);

        var uuids = await ordered
            // Domknięcie stabilnym kluczem — bez niego dwie kategorie o tej samej nazwie
            // mogą pojawić się na dwóch stronach albo zniknąć między nimi.
            .ThenBy(c => c.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(c => c.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<CategoryDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Categories.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(c => uuidList.Contains(c.Uuid));
        }

        return await query
            .Select(c => new CategoryDto(c.Uuid, c.Name, c.ParentUuid))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<GetCategoryChildrenResponse> GetChildrenAsync(
        GetCategoryChildrenRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.Categories
            .AsNoTracking()
            .Where(c => c.ParentUuid == request.ParentUuid);

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var nodes = await query
            .OrderBy(c => c.Name)
            .ThenBy(c => c.Uuid)
            .Skip(Math.Max(request.PageIndex, 0) * request.PageSize)
            .Take(request.PageSize)
            .Select(TreeNodeProjection)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new GetCategoryChildrenResponse { Nodes = nodes, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<SearchCategoryTreeResponse> SearchTreeAsync(
        SearchCategoryTreeRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var term = request.Search?.Trim();
        if (string.IsNullOrEmpty(term))
        {
            return new SearchCategoryTreeResponse();
        }

        var matchesQuery = _dbContext.Categories
            .AsNoTracking()
            .Where(c => EF.Functions.ILike(c.Name, $"%{term}%"));

        var totalCount = await matchesQuery.CountAsync(cancellationToken).ConfigureAwait(false);

        // Limit jest twardy i celowy: wyszukanie „a" w drzewie o setkach tysięcy węzłów
        // trafiłoby w niemal wszystko, a UI i tak pokazuje ograniczoną listę wyników.
        // `totalCount` powyżej niesie pełną liczbę trafień, więc informacja nie ginie.
        const int maxMatches = 200;

        var matches = await matchesQuery
            .OrderBy(c => c.Name)
            .ThenBy(c => c.Uuid)
            .Take(maxMatches)
            .Select(TreeNodeProjection)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var matchUuids = matches.ConvertAll(m => m.Uuid);

        // Przodkowie trafień jednym zapytaniem po tabeli domknięcia (depth > 0 pomija
        // wiersze węzłów do samych siebie), zamiast wspinania się po rodzicach per trafienie.
        var ancestorUuids = await _dbContext.CategoryClosure
            .AsNoTracking()
            .Where(e => matchUuids.Contains(e.DescendantUuid) && e.Depth > 0)
            .Select(e => e.AncestorUuid)
            .Distinct()
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var ancestors = await _dbContext.Categories
            .AsNoTracking()
            .Where(c => ancestorUuids.Contains(c.Uuid))
            .Select(TreeNodeProjection)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchCategoryTreeResponse
        {
            Matches = matches,
            Ancestors = ancestors,
            TotalCount = totalCount,
        };
    }

    /// <summary>
    /// Projekcja kategorii na węzeł drzewa wraz z metadanymi hierarchii.
    ///
    /// Musi być <b>wyrażeniem</b>, a nie zwykłą metodą: EF Core tłumaczy na SQL drzewo wyrażeń,
    /// a wywołania metody nie potrafi rozłożyć na podzapytania. Dzięki tej formie licznik dzieci
    /// i licznik potomków stają się skorelowanymi podzapytaniami liczonymi przez Postgresa
    /// po indeksach — zamiast pobierania poddrzewa do pamięci procesu.
    /// </summary>
    private System.Linq.Expressions.Expression<Func<Category, CategoryTreeNodeDto>> TreeNodeProjection
        => category => new CategoryTreeNodeDto(
            category.Uuid,
            category.Name,
            category.ParentUuid,
            _dbContext.Categories.Any(child => child.ParentUuid == category.Uuid),
            _dbContext.Categories.Count(child => child.ParentUuid == category.Uuid),
            _dbContext.CategoryClosure.Count(e => e.AncestorUuid == category.Uuid && e.Depth > 0));
}
