using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Multimedia.Command;

/// <summary>
/// Seryjne zlecenie wygenerowania miniaturek i podglądów dla zasobów, które ich nie mają.
///
/// <para>Zlecenie generowania wychodzi normalnie raz — przy rejestracji pliku. Zasoby wgrane,
/// zanim generator zaczął działać, nie mają jak go dostać, więc bez tego endpointu jedynym
/// sposobem nadrobienia byłoby wgranie wszystkiego od nowa
/// (<c>docs/guides/backend/media-storage.md</c> §7).</para>
///
/// <para><b>Zadanie kończy się na przyjęciu zleceń, nie na gotowych plikach.</b> Warianty
/// powstają w konsumencie, po zatwierdzeniu transakcji — patrz
/// <see cref="MultimediaExecGenerateDerivativesCommandHandler"/>. Frontend zobaczy je
/// zdarzeniem <c>AggregateChanged</c> dla <c>catalog.multimedia</c>, a nie w raporcie zadania.</para>
/// </summary>
public sealed class MultimediaExecGenerateDerivativesMultipleCommandEndpoint
    : BatchEndpointBase<MultimediaExecGenerateDerivativesCommand, SearchMultimediaRequest>
{
    private readonly IMultimediaQueries _queries;

    public MultimediaExecGenerateDerivativesMultipleCommandEndpoint(IMultimediaQueries queries)
        => _queries = queries;

    public override void Configure()
    {
        Post("batch-exec-generate-derivatives");
        Group<MultimediaGroup>();
        Permissions(P.Catalog.MultimediaUpdate);
        Description(d => d
            .WithSummary("Seryjne zlecenie wygenerowania wariantów pochodnych")
            .WithDescription(
                "Ponawia generowanie miniaturki i podglądu dla wskazanych zasobów. Element "
                + "odpada z błędem `multimedia_derivatives_unsupported` (zasób nie jest obrazem "
                + "z naszego magazynu) albo `multimedia_derivative_source_too_large` (oryginał "
                + "ponad próg dekodowania). Sukces oznacza przyjęcie zlecenia — pliki powstają "
                + "asynchronicznie i zgłaszają się przez `AggregateChanged`."));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchMultimediaRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
