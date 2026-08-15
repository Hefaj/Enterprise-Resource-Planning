using Catalog.Application.Contracts;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Tests;

/// <summary>
/// Podstawka pod reguły wsadowe. Ręcznie, bez biblioteki mockującej — reguły potrzebują dwóch
/// metod odczytowych, a jawny fake czyta się w teście lepiej niż konfiguracja mocka i od razu
/// pokazuje, jaki stan bazy test zakłada.
/// </summary>
internal sealed class FakeProductQueries : IProductQueries
{
    /// <summary>Produkty istniejące w „bazie”.</summary>
    public HashSet<Guid> ExistingUuids { get; init; } = [];

    /// <summary>Sygnatura duplikatu → produkt, który ją zajmuje.</summary>
    public Dictionary<string, Guid> OwnersByDuplicateKey { get; init; } = new(StringComparer.Ordinal);

    /// <summary>Ile razy reguła odpytała bazę — walidacja wsadowa ma to robić raz na wsad.</summary>
    public int DuplicateKeyQueryCount { get; private set; }

    public Task<List<Guid>> GetExistingUuidsAsync(
        IReadOnlyCollection<Guid> uuids,
        CancellationToken cancellationToken)
        => Task.FromResult(uuids.Where(ExistingUuids.Contains).ToList());

    public Task<Dictionary<string, Guid>> GetOwnersByDuplicateKeysAsync(
        IReadOnlyCollection<string> duplicateKeys,
        CancellationToken cancellationToken)
    {
        DuplicateKeyQueryCount++;

        return Task.FromResult(duplicateKeys
            .Where(OwnersByDuplicateKey.ContainsKey)
            .ToDictionary(k => k, k => OwnersByDuplicateKey[k], StringComparer.Ordinal));
    }

    public Task<SearchResponse> SearchAsync(SearchProductRequest request, CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<List<ProductDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken)
        => throw new NotSupportedException();

    public Task<List<Guid>> GetMatchingUuidsAsync(SearchProductRequest request, CancellationToken cancellationToken)
        => throw new NotSupportedException();
}
