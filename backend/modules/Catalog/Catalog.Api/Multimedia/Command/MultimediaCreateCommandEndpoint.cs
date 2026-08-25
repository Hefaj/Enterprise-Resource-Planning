using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Api.Commands;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Microsoft.Extensions.Options;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Multimedia.Command;

/// <summary>
/// Rejestruje w katalogu pliki wgrane wcześniej prosto do magazynu.
///
/// <para><b>Dlaczego to NIE jest endpoint wsadowy</b>, mimo że przyjmuje listę — drugi taki
/// wyjątek w systemie, po <c>ExportRunCreateCommandEndpoint</c>. Zadanie masowe kupuje trzy
/// rzeczy: postęp, sukces częściowy i odporność na restart. Tutaj żadna z nich nie ma nabywcy:
/// kosztowny etap (transfer bajtów) już się odbył po stronie przeglądarki, zostaje wstawienie
/// kilkunastu wierszy, a użytkownik patrzy na modal i czeka.</para>
///
/// <para><b>Rozstrzygające jest jednak co innego: klient potrzebuje uuidów NATYCHMIAST.</b>
/// Zaraz po tym woła <c>product/batch-add-multimedia</c>, a tamta operacja waliduje istnienie
/// zasobów. Gdyby rejestracja szła przez zadanie, klient dostałby <c>jobUuid</c> i musiałby
/// czekać na jego zakończenie, zanim w ogóle mógłby zlecić dopięcie — dwufazowy taniec wokół
/// kilkunastu INSERT-ów, w którym drugi krok odbija się od walidacji, jeśli pierwszy nie zdążył.</para>
///
/// <para>Dopięcie do produktów zostaje normalną operacją masową i to jest właściwy podział:
/// plików są dziesiątki, produktów mogą być tysiące.</para>
/// </summary>
public sealed class MultimediaCreateCommandEndpoint
    : Endpoint<MultimediaCreateRequest, MultimediaCreateResponse>
{
    private readonly ICommandDispatcher _dispatcher;
    private readonly IUnitOfWork _unitOfWork;
    private readonly MultimediaOptions _options;

    public MultimediaCreateCommandEndpoint(
        ICommandDispatcher dispatcher,
        IUnitOfWork unitOfWork,
        IOptions<MultimediaOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);

        _dispatcher = dispatcher;
        _unitOfWork = unitOfWork;
        _options = options.Value;
    }

    public override void Configure()
    {
        Post("create");
        Group<MultimediaGroup>();
        Permissions(P.Catalog.MultimediaUpdate);
        Description(d => d
            .WithSummary("Rejestracja wgranych plików w katalogu")
            .WithDescription(
                "Zakłada wpisy dla plików wgranych przez adresy z "
                + "`multimedia/getMultimediaUploadTickets` i zwraca ich identyfikatory. "
                + "Wszystko albo nic: plik, który nie dotarł do magazynu, odrzuca całe żądanie."));
    }

    public override async Task HandleAsync(MultimediaCreateRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        // Tyle, ile biletów wydaje `GetMultimediaUploadTicketsEndpoint` — obie granice biorą się
        // z jednej opcji, żeby nie dało się dostać większej paczki biletów, niż wolno zapisać.
        if (req.Commands.Count == 0 || req.Commands.Count > _options.MaxFilesPerRequest)
        {
            AddError(r => r.Commands, $"Liczba plików musi mieścić się w zakresie 1–{_options.MaxFilesPerRequest}.");
            ThrowIfAnyErrors();
        }

        var uuids = new List<Guid>(req.Commands.Count);

        // Jedna transakcja na całą paczkę: granicę przejmuje endpoint, więc pipeline komend
        // nie zatwierdza po każdym pliku (patrz docs/backend/cqrs.md §3). Katalog, w którym
        // wylądowała połowa wgranej galerii, byłby gorszy niż odrzucenie całości.
        using (_dispatcher.OwnTransaction())
        {
            foreach (var command in req.Commands)
            {
                uuids.Add(await _dispatcher.SendAsync<MultimediaCreateCommand, Guid>(command, ct));
            }

            await _unitOfWork.SaveChangesAsync(ct);
        }

        await Send.OkAsync(new MultimediaCreateResponse(uuids), ct);
    }
}
