using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Multimedia.Command;

/// <summary>
/// Seryjne usunięcie zasobów multimedialnych z katalogu.
///
/// <para><b>Tu, w odróżnieniu od rejestracji, zadanie masowe ma pełny sens</b> — i dlatego jest
/// to zwykły <c>BatchEndpointBase</c>, a nie kolejny wyjątek. Klient nie potrzebuje wyniku
/// natychmiast (nie ma następnego kroku, który by na nim stał), a sukces częściowy jest wręcz
/// pożądany: z paczki dwudziestu zasobów te używane przez produkty mają odpaść pojedynczo,
/// z czytelnym powodem, a nie odrzucić całą operację.</para>
///
/// <para>Plik w magazynie kasuje się osobno i asynchronicznie — patrz
/// <see cref="MultimediaRemoveCommandHandler"/>.</para>
/// </summary>
public sealed class MultimediaRemoveCommandEndpoint
    : BatchEndpointBase<MultimediaRemoveCommand, SearchMultimediaRequest>
{
    private readonly IMultimediaQueries _queries;

    public MultimediaRemoveCommandEndpoint(IMultimediaQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove");
        Group<MultimediaGroup>();
        Permissions(P.Catalog.MultimediaUpdate);
        Description(d => d
            .WithSummary("Seryjne usunięcie zasobów multimedialnych z obsługą błędów cząstkowych")
            .WithDescription(
                "Usuwa wskazane zasoby i zleca skasowanie ich plików w magazynie. Zasób używany "
                + "przez choćby jeden produkt odpada z błędem `multimedia_still_referenced` — "
                + "odepnij go najpierw. Pozostałe elementy paczki przechodzą normalnie."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchMultimediaRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
