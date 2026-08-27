using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>
/// Wydaje zawartość załącznika — tędy idą obrazki osadzone w opisie zgłoszenia.
///
/// <para><b>Przez serwis, a nie presigned URL-em jak eksporty.</b> Adres podpisany żyje minuty
/// i jest bearer-owy: dla pliku pobieranego raz po kliknięciu to zaleta, dla obrazka w treści
/// renderowanej przy każdym otwarciu karty — wada podwójna. Adres wygasłby w połowie czytania,
/// a każdy `&lt;img&gt;` wymagałby wcześniejszej wymiany identyfikatora na link. Tutaj adres jest
/// trwały, uprawnienie sprawdza się przy każdym żądaniu, a odwołanie dostępu działa natychmiast.</para>
///
/// <para><b>Widoczność dziedziczy po zgłoszeniu</b> — rozstrzyga to zapytanie, nie ten endpoint.
/// Uprawnienie funkcyjne mówi „czy w ogóle wolno ci czytać zgłoszenia", a predykat projektowy
/// w <c>IssueAttachmentQueries</c> — „czy wolno ci czytać TO". Bez drugiego uuid załącznika
/// wystarczyłby, żeby pobrać zrzut ekranu ze zgłoszenia w cudzym projekcie.</para>
/// </summary>
public sealed class GetIssueAttachmentContentEndpoint : Endpoint<GetIssueAttachmentContentRequest>
{
    /// <summary>
    /// Zawartość pod danym uuid nigdy się nie zmienia — podmiana pliku to nowy załącznik, nie
    /// edycja istniejącego. Stąd długi cache z <c>immutable</c>. <c>private</c>, bo odpowiedź
    /// jest za uprawnieniem i nie ma prawa wylądować we wspólnym cache pośrednika.
    /// </summary>
    private const string CachePolicy = "private, max-age=86400, immutable";

    private readonly IIssueAttachmentQueries _queries;
    private readonly IArtifactStore _artifacts;

    public GetIssueAttachmentContentEndpoint(
        IIssueAttachmentQueries queries,
        [FromKeyedServices(ArtifactStoreKeys.Media)] IArtifactStore artifacts)
    {
        _queries = queries;
        _artifacts = artifacts;
    }

    public override void Configure()
    {
        // GET, a nie POST jak reszta odczytów modułu: to jedyny endpoint, którego odpowiedź jest
        // plikiem, a nie JSON-em — i jedyny, który ma prawo trafić do cache przeglądarki.
        Get("attachment/content/{uuid}");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
        Description(d => d.WithSummary("Zawartość załącznika zgłoszenia"));
    }

    public override async Task HandleAsync(GetIssueAttachmentContentRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var content = await _queries.GetContentRefAsync(req.Uuid, ct);

        if (content is null)
        {
            // Brak dostępu i brak pliku dają tę samą odpowiedź celowo — rozróżnienie zdradzałoby
            // istnienie załączników w projektach, których użytkownik nie widzi.
            await Send.NotFoundAsync(ct);
            return;
        }

        // Nagłówki z bazy, nie z magazynu: zawartość pod danym uuid jest niezmienna, więc katalog
        // wie o pliku dokładnie to samo co `StatObject` — i wie to bez round-tripu.
        HttpContext.Response.Headers.CacheControl = CachePolicy;
        HttpContext.Response.ContentType = content.MimeType;
        HttpContext.Response.ContentLength = content.FileSize;
        HttpContext.Response.Headers.ContentDisposition =
            $"inline; filename*=UTF-8''{Uri.EscapeDataString(content.FileName)}";

        var served = await _artifacts.ReadToAsync(content.ArtifactUuid, HttpContext.Response.Body, ct);

        if (served || HttpContext.Response.HasStarted)
        {
            return;
        }

        // Wiersz jest, pliku nie ma. Deklarację długości trzeba wycofać, bo do 404 nie pasuje.
        HttpContext.Response.ContentLength = null;
        await Send.NotFoundAsync(ct);
    }
}
