using FastEndpoints;
using Sales.Application.Customers;

namespace Sales.Customers.Query;

/// <summary>Pobranie klientów po identyfikatorach.</summary>
public sealed class GetCustomerEndpoint : Endpoint<GetCustomerRequest, List<CustomerDto>>
{
    private readonly ICustomerQueries _queries;

    public GetCustomerEndpoint(ICustomerQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getCustomer");
        Group<CustomerGroup>();
    }

    public override async Task HandleAsync(GetCustomerRequest req, CancellationToken ct)
    {
        var customers = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(customers, ct);
    }
}
