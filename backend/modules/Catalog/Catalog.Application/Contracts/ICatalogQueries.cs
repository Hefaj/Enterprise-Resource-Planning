using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.Contracts;

// Strona odczytu CQRS. Interfejsy żyją tu, implementacje w Catalog.Infrastructure —
// dzięki temu warstwa Application nie zna EF Core (pilnuje tego Erp.ArchitectureTests),
// a endpointy w Catalog.Api zależą od abstrakcji, nie od dostawcy bazy.
//
// Zapytania świadomie OMIJAJĄ repozytoria i agregaty domenowe: rzutują wprost z tabel na DTO
// (`AsNoTracking` + projekcja). To jest cel rozdziału na komendy i zapytania, a nie skrót —
// materializowanie pełnych agregatów tylko po to, żeby zaraz spłaszczyć je do DTO, kosztuje
// przy listach po kilkaset pozycji i nie daje nic w zamian.

/// <summary>Odczyty produktów.</summary>
public interface IProductQueries
{
    Task<SearchResponse> SearchAsync(SearchProductRequest request, CancellationToken cancellationToken);

    Task<List<ProductDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    /// <summary>Identyfikatory produktów pasujących do filtra, bez stronicowania —
    /// używane przez operacje masowe do wyznaczenia zbioru celów.</summary>
    Task<List<Guid>> GetMatchingUuidsAsync(SearchProductRequest request, CancellationToken cancellationToken);

    /// <summary>
    /// Spośród podanych identyfikatorów zwraca te, które faktycznie istnieją jako produkty.
    ///
    /// Jedno zbiorcze zapytanie zamiast N osobnych <c>FindAsync</c> — używane przez
    /// walidację wsadową (<c>ProductMustExistRule</c>), która musi odsiać nieistniejące cele
    /// operacji masowej PRZED utworzeniem zadania, nie po jednym elemencie naraz.
    /// </summary>
    Task<List<Guid>> GetExistingUuidsAsync(IReadOnlyCollection<Guid> uuids, CancellationToken cancellationToken);
}

/// <summary>Odczyty kategorii, łącznie z widokami drzewiastymi.</summary>
public interface ICategoryQueries
{
    Task<SearchResponse> SearchAsync(SearchCategoryRequest request, CancellationToken cancellationToken);

    Task<List<CategoryDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    Task<GetCategoryChildrenResponse> GetChildrenAsync(
        GetCategoryChildrenRequest request,
        CancellationToken cancellationToken);

    Task<SearchCategoryTreeResponse> SearchTreeAsync(
        SearchCategoryTreeRequest request,
        CancellationToken cancellationToken);
}

/// <summary>Odczyty modeli.</summary>
public interface IModelQueries
{
    Task<SearchResponse> SearchAsync(SearchModelRequest request, CancellationToken cancellationToken);

    Task<List<ModelDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);
}

/// <summary>Odczyty multimediów.</summary>
public interface IMultimediaQueries
{
    Task<SearchResponse> SearchAsync(SearchMultimediaRequest request, CancellationToken cancellationToken);

    Task<List<MultimediaDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);
}

/// <summary>Odczyty gwarancji.</summary>
public interface IWarrantyQueries
{
    Task<SearchResponse> SearchAsync(SearchWarrantyRequest request, CancellationToken cancellationToken);

    Task<List<WarrantyDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);
}
