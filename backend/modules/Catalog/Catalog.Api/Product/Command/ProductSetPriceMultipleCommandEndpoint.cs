using Catalog.Application.Contracts;
using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Product.Command;

/// <summary>Seryjna zmiana cen produktów.</summary>
public sealed class ProductSetPriceMultipleCommandEndpoint
    : BatchEndpointBase<ProductSetPriceCommand, SearchProductRequest>
{
    private readonly IProductQueries _queries;

    public ProductSetPriceMultipleCommandEndpoint(IProductQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("product/batch-set-price");
        Group<ProductGroup>();
        Description(d => d
            .WithSummary("Seryjna aktualizacja cen produktów z obsługą błędów cząstkowych")
            .WithDescription(
                "Umożliwia zmianę ceny wielu produktów jednocześnie na podstawie filtrów, "
                + "identyfikatorów lub konkretnych komend."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProductRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
