using Catalog.Application.Contracts;
using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;

namespace Catalog.Product.Command;

/// <summary>Seryjna zmiana cen produktów.</summary>
public sealed class ProductSetPriceMultipleCommandEndpoint
    : BatchEndpointBase<ProductSetPriceCommand, SearchProductRequest>
{
    private readonly IProductQueries _queries;
    private readonly ProductMustExistRule _productMustExistRule;

    public ProductSetPriceMultipleCommandEndpoint(IProductQueries queries, ProductMustExistRule productMustExistRule)
    {
        _queries = queries;
        _productMustExistRule = productMustExistRule;
    }

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

    /// <inheritdoc />
    protected override async Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken ct)
    {
        var tracker = new ValidationTracker();
        await _productMustExistRule.ExecuteAsync(aggregateUuids, uuid => uuid, tracker, ct).ConfigureAwait(false);
        return tracker;
    }
}
