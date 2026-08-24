using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Artifacts;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
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
    private readonly IArtifactStore _artifacts;
    private readonly MultimediaOptions _options;
    private readonly ErpArtifactOptions _artifactOptions;

    public GetMultimediaUploadTicketsEndpoint(
        // Magazyn trwały: zdjęcia produktów mają przeżyć retencję eksportów.
        [FromKeyedServices(ArtifactStoreKeys.Media)] IArtifactStore artifacts,
        IOptions<MultimediaOptions> options,
        IOptions<ErpArtifactOptions> artifactOptions)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(artifactOptions);

        _artifacts = artifacts;
        _options = options.Value;
        _artifactOptions = artifactOptions.Value;
    }

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

        // Górna granica jednej paczki nie chroni przed niczym groźnym — chroni przed wybiciem
        // tysiąca podpisów jednym żądaniem, gdyby po drugiej stronie coś się zapętliło.
        if (req.Count < 1 || req.Count > _options.MaxFilesPerRequest)
        {
            AddError(r => r.Count, $"Liczba plików musi mieścić się w zakresie 1–{_options.MaxFilesPerRequest}.");
            ThrowIfAnyErrors();
        }

        var tickets = new List<MultimediaUploadTicketDto>(req.Count);

        for (var i = 0; i < req.Count; i++)
        {
            // TTL biletu: tyle, ile trzeba na wgranie dużego pliku przez łącze użytkownika.
            var ticket = await _artifacts.CreateUploadTicketAsync(_artifactOptions.UploadUrlTtl, ct);

            tickets.Add(new MultimediaUploadTicketDto(
                ticket.Uuid,
                ticket.Url.ToString(),
                ticket.ExpiresOn.UtcDateTime));
        }

        await Send.OkAsync(tickets, ct);
    }
}
