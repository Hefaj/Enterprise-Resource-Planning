using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Products.Command;

/// <summary>
/// Seryjna podmiana galerii produktów; pusta lista czyści ją do zera.
///
/// <para>To jest droga dla „zdejmij wszystkie multimedia" z zaznaczenia opisanego filtrem —
/// front nie zna zawartości galerii produktów, których nie wczytał, więc adresuje stan
/// docelowy, nie zawartość.</para>
///
/// <para>Pre-check jest ten sam co przy dopinaniu, z jedną różnicą: pusta lista jest tu
/// poprawnym żądaniem, a nie brakiem celu operacji.</para>
/// </summary>
public sealed class ProductSetMultimediaMultipleCommandEndpoint
    : BatchEndpointBase<ProductSetMultimediaCommand, SearchProductRequest>
{
    private readonly IProductQueries _queries;
    private readonly ProductBatchValidator _validator;

    public ProductSetMultimediaMultipleCommandEndpoint(
        IProductQueries queries,
        ProductBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-set-multimedia");
        Group<ProductGroup>();
        Permissions(P.Catalog.MultimediaUpdate);
        Description(d => d
            .WithSummary("Seryjna podmiana galerii produktów z obsługą błędów cząstkowych")
            .WithDescription(
                "Ustawia komplet zasobów produktu na dokładnie ten z komendy. Pusta lista "
                + "czyści galerię. Nieistniejący zasób odrzuca całe żądanie jeszcze przed "
                + "utworzeniem zadania."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProductRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<ProductSetMultimediaCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateSetMultimediaAsync(
            [.. targets.Select(t => new ProductMultimediaTarget(t.AggregateUuid, t.Command.MultimediaUuids))],
            ct);
}
