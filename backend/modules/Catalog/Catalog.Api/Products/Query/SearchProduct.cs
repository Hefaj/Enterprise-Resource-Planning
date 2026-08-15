using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Products.Query;

/// <summary>
/// Wyszukiwanie produktów — zwraca wyłącznie identyfikatory i licznik.
///
/// Kontrakt „szukaj → uuid, potem pobierz po uuid” jest podyktowany sposobem, w jaki działa
/// frontend: <c>BaseOrchestrator</c> trzyma agregaty w <c>IdentityMapStore</c>, więc po
/// wyszukiwaniu dociąga tylko te, których jeszcze nie ma w cache. Zwracanie pełnych DTO
/// z wyszukiwania psułoby ten mechanizm i przesyłało dane, które klient już ma.
/// </summary>
public sealed class SearchProductEndpoint : Endpoint<SearchProductRequest, SearchResponse>
{
    private readonly IProductQueries _queries;

    public SearchProductEndpoint(IProductQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchProduct");
        Group<ProductGroup>();
    }

    public override async Task HandleAsync(SearchProductRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
