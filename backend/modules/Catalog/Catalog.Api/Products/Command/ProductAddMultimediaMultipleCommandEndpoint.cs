using Catalog.Application.Products;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Products.Command;

/// <summary>
/// Seryjne dopięcie multimediów do produktów.
///
/// <para>Wszystkie trzy tryby wskazywania celów mają tu sens, i to jest cały powód, dla którego
/// lista plików siedzi WEWNĄTRZ komendy: w trybie „szablon + filtr" jedno zadanie dopina tę samą
/// paczkę zdjęć do każdego produktu pasującego do filtra, bez wypisywania celów w żądaniu.</para>
/// </summary>
public sealed class ProductAddMultimediaMultipleCommandEndpoint
    : BatchEndpointBase<ProductAddMultimediaCommand, SearchProductRequest>
{
    private readonly IProductQueries _queries;
    private readonly ProductBatchValidator _validator;

    public ProductAddMultimediaMultipleCommandEndpoint(
        IProductQueries queries,
        ProductBatchValidator validator)
    {
        _queries = queries;
        _validator = validator;
    }

    public override void Configure()
    {
        Post("batch-add-multimedia");
        Group<ProductGroup>();
        Permissions(P.Catalog.MultimediaUpdate);
        Description(d => d
            .WithSummary("Seryjne dopięcie multimediów do produktów z obsługą błędów cząstkowych")
            .WithDescription(
                "Dopina wskazane zasoby do wielu produktów jednocześnie, zachowując te już "
                + "przypisane. Powtórzenia są pomijane; nieistniejący zasób odrzuca całe żądanie "
                + "jeszcze przed utworzeniem zadania."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProductRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);

    /// <inheritdoc />
    protected override Task<ValidationTracker> ValidateTargetsAsync(
        IReadOnlyList<BatchTarget<ProductAddMultimediaCommand>> targets,
        CancellationToken ct)
        => _validator.ValidateAddMultimediaAsync(
            [.. targets.Select(t => new ProductMultimediaTarget(t.AggregateUuid, t.Command.MultimediaUuids))],
            ct);
}
