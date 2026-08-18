using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Products.Command;

/// <summary>
/// Seryjna zmiana nazw produktów. Cele wskazuje się na trzy sposoby — jawną listą komend,
/// szablonem z listą identyfikatorów albo szablonem z filtrem — i to jest kontrakt
/// <c>BatchCommand</c>, wspólny dla wszystkich operacji masowych.
/// </summary>
public sealed class ProductSetNameMultipleCommandEndpoint
    : BatchEndpointBase<ProductSetNameCommand, SearchProductRequest>
{
    private readonly IProductQueries _queries;
    private readonly ProductBatchValidator _validator;

    public ProductSetNameMultipleCommandEndpoint(IProductQueries queries, ProductBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("product/batch-set-name");
        Group<ProductGroup>();
        Permissions(P.Catalog.ProductUpdate);
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

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<ProductSetNameCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateSetNameAsync([.. targets.Select(t => t.AggregateUuid)], ct);
}
