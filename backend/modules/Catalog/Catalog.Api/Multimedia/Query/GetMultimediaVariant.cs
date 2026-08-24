using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Multimedia.Query;

/// <summary>
/// Wydaje wariant pochodny zasobu — miniaturkę do komórki tabeli, podgląd do modalu.
///
/// <para><b>Po co osobny endpoint, skoro zawartość już się wydaje.</b> Bez niego komórka 40×40
/// pobiera oryginał: zdjęcie 4K to ok. 6 MB, więc tabela pięćdziesięciu wierszy ściąga ~300 MB,
/// a `blob:`-cache przeglądarki trzyma to wszystko w pamięci karty. Miniaturka waży kilkanaście
/// kilobajtów.</para>
///
/// <para><b>Wariant jest w ścieżce, nie w query stringu</b>, i to jest decyzja o cache'owaniu:
/// odpowiedź niesie <c>immutable</c>, więc każdy wariant musi mieć własny, trwały adres.
/// Parametr zapytania działałby tak samo dla przeglądarki, ale zachęcałby do dokładania
/// dowolnych rozmiarów — a zestaw wariantów jest zamknięty, bo pliki powstają z góry.</para>
///
/// <para><b>Brak wariantu to 404, nie ciche podanie oryginału.</b> Warianty powstają
/// asynchronicznie i przez kilka sekund po wgraniu ich nie ma. Podstawienie oryginału
/// „żeby coś było" zrobiłoby dokładnie to, czemu ten endpoint zapobiega — i to niewidocznie.
/// Klient wie z <c>MultimediaDto.hasDerivatives</c>, kiedy pytać.</para>
/// </summary>
public sealed class GetMultimediaVariantEndpoint : Endpoint<GetMultimediaVariantRequest>
{
    /// <inheritdoc cref="GetMultimediaContentEndpoint"/>
    private const string CachePolicy = "private, max-age=86400, immutable";

    private readonly IMultimediaQueries _queries;
    private readonly IArtifactStore _artifacts;

    public GetMultimediaVariantEndpoint(
        IMultimediaQueries queries,
        [FromKeyedServices(ArtifactStoreKeys.Media)] IArtifactStore artifacts)
    {
        _queries = queries;
        _artifacts = artifacts;
    }

    public override void Configure()
    {
        Get("content/{uuid}/{variant}");
        Group<MultimediaGroup>();
        Permissions(P.Catalog.DictionaryRead);
        Description(d => d
            .WithSummary("Wariant pochodny zasobu (miniaturka, podgląd)")
            .WithDescription(
                "Strumieniuje przeskalowaną wersję obrazu w formacie WebP. Dopuszczalne warianty: "
                + "`thumb`, `preview`. Zwraca 404, dopóki warianty nie zostaną wygenerowane — "
                + "gotowość sygnalizuje `hasDerivatives` w DTO zasobu."));
    }

    public override async Task HandleAsync(GetMultimediaVariantRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        // Zamknięta lista, a nie dowolny napis: nazwa wariantu wchodzi do klucza obiektu
        // w magazynie, więc przepuszczenie dowolnej wartości byłoby zaproszeniem do sondowania
        // kubełka cudzymi kluczami.
        if (!MultimediaVariants.All.Contains(req.Variant))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var content = await _queries.GetContentRefAsync(req.Uuid, ct);

        if (content is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        HttpContext.Response.Headers.CacheControl = CachePolicy;
        HttpContext.Response.ContentType = VariantContentType;

        // Bez `Content-Length`: rozmiaru wariantu nie trzymamy w bazie, a odpytanie magazynu
        // o metadane dokładałoby round-trip do każdej miniaturki — czyli koszt tego samego
        // rzędu co oszczędność. Kestrel wysyła to porcjami i przeglądarki są z tym w porządku.
        var served = await _artifacts.ReadVariantToAsync(
            content.ArtifactUuid,
            req.Variant,
            HttpContext.Response.Body,
            ct);

        if (!served && !HttpContext.Response.HasStarted)
        {
            await Send.NotFoundAsync(ct);
        }
    }

    /// <summary>Wszystkie warianty powstają jako WebP — patrz <c>ImageDerivativeGenerator</c>.</summary>
    private const string VariantContentType = "image/webp";
}
