using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using Sales.Application.Customers;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Sales.Customers.Command;

/// <summary>
/// Seryjna zmiana nazw klientów — bulk command przez dokładnie tę samą infrastrukturę
/// co w Catalogu (<c>BatchEndpointBase</c> → trwałe zadanie → <c>BulkCommandRunner</c>),
/// bez jednej linijki nowego kodu w BuildingBlocks. To jest właściwy sprawdzian tego modułu.
/// </summary>
public sealed class CustomerSetNameMultipleCommandEndpoint
    : BatchEndpointBase<CustomerSetNameCommand, SearchCustomerRequest>
{
    private readonly ICustomerQueries _queries;

    public CustomerSetNameMultipleCommandEndpoint(ICustomerQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-name");
        Group<CustomerGroup>();
        Permissions(P.Sales.CustomerUpdate);
        Description(d => d
            .WithSummary("Seryjna aktualizacja nazw klientów z obsługą błędów cząstkowych"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchCustomerRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
