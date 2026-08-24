using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Multimedia.Query;

/// <summary>
/// Wydaje adresy, pod które przeglądarka wgra pliki prosto do magazynu.
///
/// <para><b>Dlaczego bajty nie idą przez ten serwis.</b> Zdjęcia produktów bywają liczone
/// w dziesiątkach megabajtów, a wgrywa się je paczkami. Przepuszczenie ich przez endpoint
/// modułu oznaczałoby żądania HTTP trzymane otwarte na czas transferu i drugi komplet bajtów
/// przechodzący przez proces .NET bez żadnego pożytku — magazyn i tak przyjmie je bezpośrednio.</para>
///
/// <para><b>Co ten endpoint oddaje, a czego nie.</b> Adres jest bearer-owy i uprawnia do zapisu
/// pod JEDNYM identyfikatorem, którego posiadacz biletu i tak nie wybiera. Nie daje dostępu
/// do niczego, co już w magazynie leży, i sam z siebie nie zakłada nic w katalogu: dopóki nie
/// przyjdzie <c>MultimediaCreateCommand</c>, wgrany obiekt jest niczyim śmieciem, a nie zasobem.</para>
/// </summary>
public sealed class GetMultimediaUploadTicketsEndpoint
    : Endpoint<GetMultimediaUploadTicketsRequest, List<MultimediaUploadTicketDto>>
{
    /// <summary>
    /// Górna granica jednej paczki. Nie chroni przed niczym groźnym — chroni przed wybiciem
    /// tysiąca podpisów jednym żądaniem, gdyby po drugiej stronie coś się zapętliło.
    /// </summary>
    private const int MaxTicketsPerRequest = 100;

    private readonly IArtifactStore _artifacts;

    public GetMultimediaUploadTicketsEndpoint(
        // Magazyn trwały: zdjęcia produktów mają przeżyć retencję eksportów.
        [FromKeyedServices(ArtifactStoreKeys.Media)] IArtifactStore artifacts)
        => _artifacts = artifacts;

    /// <summary>Tyle, ile trzeba na wgranie dużego pliku przez łącze użytkownika.</summary>
    private static readonly TimeSpan TicketTtl = TimeSpan.FromMinutes(30);

    public override void Configure()
    {
        Post("getMultimediaUploadTickets");
        Group<MultimediaGroup>();
        Permissions(P.Catalog.MultimediaUpdate);
        Description(d => d
            .WithSummary("Adresy do wgrania plików prosto do magazynu")
            .WithDescription(
                "Zwraca `count` jednorazowych adresów `PUT`. Po zakończonym transferze klient "
                + "rejestruje pliki komendą `multimedia/batch-create`, podając otrzymane "
                + "`artifactUuid`."));
    }

    public override async Task HandleAsync(GetMultimediaUploadTicketsRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        if (req.Count is < 1 or > MaxTicketsPerRequest)
        {
            AddError(r => r.Count, $"Liczba plików musi mieścić się w zakresie 1–{MaxTicketsPerRequest}.");
            ThrowIfAnyErrors();
        }

        var tickets = new List<MultimediaUploadTicketDto>(req.Count);

        for (var i = 0; i < req.Count; i++)
        {
            var ticket = await _artifacts.CreateUploadTicketAsync(TicketTtl, ct);

            tickets.Add(new MultimediaUploadTicketDto(
                ticket.Uuid,
                ticket.Url.ToString(),
                ticket.ExpiresOn.UtcDateTime));
        }

        await Send.OkAsync(tickets, ct);
    }
}
