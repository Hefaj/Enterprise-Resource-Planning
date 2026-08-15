using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Sales.Application.Customers;

namespace Sales.Customers.Query;

/// <summary>Wyszukiwanie klientów — zwraca identyfikatory i licznik, ten sam wzorzec
/// „szukaj → pobierz” co pozostałe moduły.</summary>
public sealed class SearchCustomerEndpoint : Endpoint<SearchCustomerRequest, SearchResponse>
{
    private readonly ICustomerQueries _queries;

    public SearchCustomerEndpoint(ICustomerQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchCustomer");
        Group<CustomerGroup>();
    }

    public override async Task HandleAsync(SearchCustomerRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
