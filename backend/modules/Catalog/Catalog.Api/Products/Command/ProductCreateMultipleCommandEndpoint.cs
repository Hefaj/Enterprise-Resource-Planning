using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Products.Command;

/// <summary>
/// Seryjne zakładanie produktów. Jedyny endpoint masowy Catalogu, dla którego tryby
/// „szablon + identyfikatory" i „szablon + filtr" NIE mają zastosowania — cel jest agregatem,
/// który jeszcze nie istnieje, więc nie ma czego wskazać. Sensowny jest wyłącznie tryb
/// <c>Commands[]</c> (jawna lista nowych produktów, każdy z własnym uuid, nazwą i ceną);
/// filtr zawsze zwraca pusty zbiór.
/// </summary>
public sealed class ProductCreateMultipleCommandEndpoint
    : BatchEndpointBase<ProductCreateCommand, SearchProductRequest>
{
    private readonly ProductBatchValidator _validator;

    public ProductCreateMultipleCommandEndpoint(ProductBatchValidator validator)
    {
        _validator = validator;
    }

    public override void Configure()
    {
        Post("product/batch-create");
        Group<ProductGroup>();
        Permissions(P.Catalog.ProductUpdate);
        Description(d => d
            .WithSummary("Seryjne zakładanie produktów z obsługą błędów cząstkowych")
            .WithDescription(
                "Zakłada wiele produktów jednocześnie na podstawie listy komend (`commands`). "
                + "Każda komenda niesie własny uuid, nazwę i cenę. Tryby filtra i identyfikatorów "
                + "nie mają zastosowania — nowy produkt nie ma jeszcze uuid, którym dałoby się "
                + "go wskazać."));
    }

    /// <inheritdoc />
    protected override Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProductRequest filter,
        CancellationToken ct)
        => Task.FromResult(Enumerable.Empty<Guid>());

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<ProductCreateCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateCreateAsync([.. targets.Select(t => t.AggregateUuid)], ct);
}
