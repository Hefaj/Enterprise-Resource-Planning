using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Sales.Application.Contracts;
using Sales.Application.Customers;

namespace Sales.Customer.Command;

/// <summary>
/// Seryjna zmiana nazw klientów — bulk command przez dokładnie tę samą infrastrukturę
/// co w Catalogu (<c>BatchEndpointBase</c> → trwałe zadanie → <c>BulkCommandRunner</c>),
/// bez jednej linijki nowego kodu w BuildingBlocks. To jest właściwy sprawdzian tego modułu.
/// </summary>
public sealed class CustomerSetNameMultipleCommandEndpoint
    : BatchEndpointBase<SetCustomerNameCommand, SearchCustomerRequest>
{
    private readonly ICustomerQueries _queries;

    public CustomerSetNameMultipleCommandEndpoint(ICustomerQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("customer/batch-set-name");
        Group<CustomerGroup>();
        Description(d => d
            .WithSummary("Seryjna aktualizacja nazw klientów z obsługą błędów cząstkowych"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchCustomerRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
