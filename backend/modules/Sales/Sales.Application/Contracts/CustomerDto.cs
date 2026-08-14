using Erp.BuildingBlocks.Api.Contracts;

namespace Sales.Application.Contracts;

/// <summary>Klient w widoku odczytu.</summary>
public sealed record CustomerDto(Guid Uuid, string Name, string Email);

/// <summary>Filtry wyszukiwania klientów.</summary>
public sealed class SearchCustomerRequest : PagedRequest
{
    public string? Name { get; set; }
}

/// <summary>Pobranie klientów po identyfikatorach.</summary>
public sealed class GetCustomerRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Odczyty klientów. Implementacja w <c>Sales.Infrastructure</c>.</summary>
public interface ICustomerQueries
{
    Task<SearchResponse> SearchAsync(SearchCustomerRequest request, CancellationToken cancellationToken);

    Task<List<CustomerDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);

    /// <summary>Identyfikatory klientów pasujących do filtra, bez stronicowania —
    /// używane przez operacje masowe do wyznaczenia zbioru celów. Celowo osobna metoda
    /// od <see cref="SearchAsync"/>: ta zwraca stronę wyników, operacja masowa potrzebuje
    /// całego zbioru pasującego do filtra.</summary>
    Task<List<Guid>> GetMatchingUuidsAsync(SearchCustomerRequest request, CancellationToken cancellationToken);
}
