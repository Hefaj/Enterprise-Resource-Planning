using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;

namespace Catalog.Products.Command;

/// <summary>Seryjna zmiana cen produktów.</summary>
public sealed class ProductSetPriceMultipleCommandEndpoint
    : BatchEndpointBase<ProductSetPriceCommand, SearchProductRequest>
{
    private readonly IProductQueries _queries;
    private readonly ProductBatchValidator _validator;

    public ProductSetPriceMultipleCommandEndpoint(IProductQueries queries, ProductBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
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
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<ProductSetPriceCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateSetPriceAsync([.. targets.Select(t => t.AggregateUuid)], ct);
}
