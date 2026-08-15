using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;

namespace Catalog.Products.Command;

/// <summary>
/// Seryjna zmiana klasyfikacji produktów — modelu i kompletu kategorii.
///
/// Pierwsza operacja masowa w tym module, dla której pre-check potrzebuje payloadu komendy,
/// a nie samych identyfikatorów: czy produkt stanie się duplikatem, zależy od tego, JAKĄ
/// klasyfikację mu nadajemy.
/// </summary>
public sealed class ProductSetClassificationMultipleCommandEndpoint
    : BatchEndpointBase<ProductSetClassificationCommand, SearchProductRequest>
{
    private readonly IProductQueries _queries;
    private readonly ProductBatchValidator _validator;

    public ProductSetClassificationMultipleCommandEndpoint(
        IProductQueries queries,
        ProductBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("product/batch-set-classification");
        Group<ProductGroup>();
        Description(d => d
            .WithSummary("Seryjna zmiana modelu i kategorii produktów z obsługą błędów cząstkowych")
            .WithDescription(
                "Umożliwia zmianę modelu i kompletu kategorii wielu produktów jednocześnie "
                + "na podstawie filtrów, identyfikatorów lub konkretnych komend. Produkty, które "
                + "po zmianie byłyby duplikatami (ten sam model i te same kategorie), są odrzucane "
                + "z kodem `product_duplicate`."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProductRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<ProductSetClassificationCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateSetClassificationAsync(
            [.. targets.Select(t => new ProductClassificationTarget(
                t.AggregateUuid,
                t.Command.ModelUuid,
                t.Command.CategoryUuids))],
            ct);
}
