using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Products.Command;

/// <summary>
/// Seryjne odpięcie multimediów od produktów.
///
/// <para>Lista plików siedzi wewnątrz komendy z tego samego powodu, co przy dopinaniu: w trybie
/// „szablon + filtr" jedno zadanie zdejmuje tę samą paczkę ze wszystkich produktów pasujących
/// do filtra.</para>
///
/// <para><b>Pre-check sprawdza wyłącznie istnienie produktu.</b> Odpinany zasób nie musi
/// istnieć ani być przy produkcie — żądanie odpięcia czegoś, czego nie ma, opisuje stan, który
/// już obowiązuje, i nie ma powodu wywracać przez nie całej paczki.</para>
/// </summary>
public sealed class ProductRemoveMultimediaMultipleCommandEndpoint
    : BatchEndpointBase<ProductRemoveMultimediaCommand, SearchProductRequest>
{
    private readonly IProductQueries _queries;
    private readonly ProductBatchValidator _validator;

    public ProductRemoveMultimediaMultipleCommandEndpoint(
        IProductQueries queries,
        ProductBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-remove-multimedia");
        Group<ProductGroup>();
        Permissions(P.Catalog.MultimediaUpdate);
        Description(d => d
            .WithSummary("Seryjne odpięcie multimediów od produktów z obsługą błędów cząstkowych")
            .WithDescription(
                "Zdejmuje wskazane zasoby z wielu produktów jednocześnie, zostawiając pozostałe. "
                + "Zasób, którego przy produkcie nie ma, jest pomijany. To odpięcie, a nie "
                + "usunięcie pliku z katalogu — do tego służy `multimedia/batch-remove`."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProductRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<ProductRemoveMultimediaCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateRemoveMultimediaAsync([.. targets.Select(t => t.AggregateUuid)], ct);
}
