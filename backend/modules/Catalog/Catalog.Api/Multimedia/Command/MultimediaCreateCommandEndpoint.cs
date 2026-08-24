using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
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
    /// <summary>Tyle, ile biletów wydaje <see cref="Query.GetMultimediaUploadTicketsEndpoint"/>.</summary>
    private const int MaxFilesPerRequest = 100;

    private readonly IUnitOfWork _unitOfWork;

    public MultimediaCreateCommandEndpoint(IUnitOfWork unitOfWork) => _unitOfWork = unitOfWork;

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

        if (req.Commands.Count is 0 or > MaxFilesPerRequest)
        {
            AddError(r => r.Commands, $"Liczba plików musi mieścić się w zakresie 1–{MaxFilesPerRequest}.");
            ThrowIfAnyErrors();
        }

        var uuids = new List<Guid>(req.Commands.Count);

        foreach (var command in req.Commands)
        {
            uuids.Add(await command.ExecuteAsync(ct));
        }

        // Jedna transakcja na całą paczkę: handlery świadomie nie wołają SaveChanges, granicę
        // wyznacza wywołujący (patrz docs/backend/cqrs.md §3). Katalog, w którym wylądowała
        // połowa wgranej galerii, byłby gorszy niż odrzucenie całości.
        await _unitOfWork.SaveChangesAsync(ct);

        await Send.OkAsync(new MultimediaCreateResponse(uuids), ct);
    }
}
