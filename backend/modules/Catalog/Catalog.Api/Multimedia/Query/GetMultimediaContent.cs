using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Multimedia.Query;

/// <summary>
/// Wydaje zawartość zasobu — miniaturki w galerii i podgląd oryginału idą tędy.
///
/// <para><b>Dlaczego przez serwis, a nie presigned URL-em jak eksporty.</b> Adres podpisany
/// żyje minuty i jest bearer-owy. Dla pliku pobieranego raz, po kliknięciu, to zaleta; dla
/// zdjęcia renderowanego w galerii — wada podwójna: adres wygasa w trakcie przeglądania listy,
/// a każda miniaturka wymagałaby wcześniejszej wymiany identyfikatora na link. Tutaj adres jest
/// trwały, uprawnienie sprawdza się przy każdym żądaniu, a odwołanie dostępu działa natychmiast.</para>
///
/// <para><b>Adresowane uuid-em zasobu, nie artefaktu</b> — tożsamość obiektu w magazynie nie
/// wychodzi poza backend. Zasób wskazany adresem zewnętrznym nie ma tu czego wydać: bajty leżą
/// poza systemem, a klient ma je pobrać wprost z <c>originalUrl</c>.</para>
/// </summary>
public sealed class GetMultimediaContentEndpoint : Endpoint<GetMultimediaContentRequest>
{
    /// <summary>
    /// Zawartość pod danym uuid nigdy się nie zmienia — podmiana pliku to nowy zasób, nie edycja
    /// istniejącego. Dlatego cache jest długi i <c>immutable</c>: przy galerii przewijanej
    /// w tę i z powrotem to różnica między jednym żądaniem na zdjęcie a jednym na spojrzenie.
    /// <c>private</c>, bo odpowiedź jest za uprawnieniem i nie ma prawa wylądować we wspólnym cache.
    /// </summary>
    private const string CachePolicy = "private, max-age=86400, immutable";

    private readonly IMultimediaQueries _queries;
    private readonly IArtifactStore _artifacts;

    public GetMultimediaContentEndpoint(
        IMultimediaQueries queries,
        [FromKeyedServices(ArtifactStoreKeys.Media)] IArtifactStore artifacts)
    {
        _queries = queries;
        _artifacts = artifacts;
    }

    public override void Configure()
    {
        // GET, a nie POST jak reszta odczytów w module: to jedyny endpoint, którego odpowiedź
        // jest plikiem, a nie JSON-em — i jedyny, który ma prawo trafić do cache przeglądarki.
        Get("content/{uuid}");
        Group<MultimediaGroup>();
        Permissions(P.Catalog.DictionaryRead);
        Description(d => d
            .WithSummary("Zawartość zasobu multimedialnego")
            .WithDescription(
                "Strumieniuje plik z magazynu. Dotyczy wyłącznie zasobów wgranych do systemu — "
                + "zasób z wypełnionym `originalUrl` pobiera się spod tamtego adresu."));
    }

    public override async Task HandleAsync(GetMultimediaContentRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var artifactUuid = await _queries.GetArtifactUuidAsync(req.Uuid, ct);

        if (artifactUuid is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var metadata = await _artifacts.GetMetadataAsync(artifactUuid.Value, ct);

        if (metadata is null)
        {
            // Wpis w katalogu jest, pliku nie ma. To nie jest stan, który wolno przemilczeć
            // pustą odpowiedzią — 404 mówi klientowi tyle samo, co o nieistniejącym zasobie,
            // a różnicę widać w logach magazynu.
            await Send.NotFoundAsync(ct);
            return;
        }

        var content = await _artifacts.OpenAsync(artifactUuid.Value, ct);

        HttpContext.Response.Headers.CacheControl = CachePolicy;

        // Strumień zamyka FastEndpoints po wysłaniu — magazyn oddaje go jako plik tymczasowy
        // z `DeleteOnClose`, więc zamknięcie jest jednocześnie sprzątnięciem.
        await Send.StreamAsync(
            content,
            metadata.FileName,
            metadata.SizeBytes,
            metadata.ContentType,
            cancellation: ct);
    }
}
