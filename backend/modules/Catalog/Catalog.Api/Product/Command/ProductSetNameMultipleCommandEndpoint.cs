using Catalog.Application.Contracts;
using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Product.Command;

/// <summary>
/// Seryjna zmiana nazw produktów. Cele wskazuje się na trzy sposoby — jawną listą komend,
/// szablonem z listą identyfikatorów albo szablonem z filtrem — i to jest kontrakt
/// <c>BatchCommand</c>, wspólny dla wszystkich operacji masowych.
/// </summary>
public sealed class ProductSetNameMultipleCommandEndpoint
    : BatchEndpointBase<ProductSetNameCommand, SearchProductRequest>
{
    private readonly IProductQueries _queries;

    public ProductSetNameMultipleCommandEndpoint(IProductQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("product/batch-set-name");
        Group<ProductGroup>();
        Description(d => d
            .WithSummary("Seryjna aktualizacja nazw produktów z obsługą błędów cząstkowych")
            .WithDescription(
                "Umożliwia zmianę nazwy wielu produktów jednocześnie na podstawie filtrów, "
                + "identyfikatorów lub konkretnych komend."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProductRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
