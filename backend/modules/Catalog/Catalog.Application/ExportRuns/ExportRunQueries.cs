using Catalog.Domain.ExportRuns;
using Erp.BuildingBlocks.Api.Contracts;

namespace Catalog.Application.ExportRuns;

/// <summary>Przebieg eksportu widziany przez klienta.</summary>
/// <param name="Uuid">Identyfikator przebiegu.</param>
/// <param name="Format">Format wyjściowy.</param>
/// <param name="Status">Stan przebiegu.</param>
/// <param name="JobUuid">Zadanie niosące przebieg do powiadomień — <c>trackingID</c> w feedzie.</param>
/// <param name="ArtifactUuid">
/// Artefakt do pobrania; <c>null</c>, dopóki przebieg nie zakończy się powodzeniem.
/// <b>To jest identyfikator, nie adres.</b> Adres pobrania klient dostaje osobnym wywołaniem,
/// tuż przed użyciem, bo jest bearer-owy i krótko ważny (patrz <c>exports-artifacts.md</c> §6).
/// </param>
/// <param name="RecordCount">Liczba rekordów zapisanych do artefaktu.</param>
/// <param name="ErrorCode">Kod błędu, gdy przebieg poległ.</param>
/// <param name="CreatedAt">Moment zlecenia.</param>
/// <param name="FinishedAt">Moment zakończenia.</param>
/// <param name="ExpireOn">Moment wygaśnięcia artefaktu.</param>
public sealed record ExportRunDto(
    Guid Uuid,
    string Format,
    ExportRunStatus Status,
    Guid JobUuid,
    Guid? ArtifactUuid,
    int RecordCount,
    string? ErrorCode,
    DateTimeOffset CreatedAt,
    DateTimeOffset? FinishedAt,
    DateTimeOffset? ExpireOn);

/// <summary>Filtry wyszukiwania przebiegów eksportu.</summary>
public sealed class SearchExportRunRequest : PagedRequest
{
    public string? Format { get; set; }

    public ExportRunStatus? Status { get; set; }
}

/// <summary>Pobranie przebiegów po identyfikatorach.</summary>
public sealed class GetExportRunRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Żądanie adresu pobrania artefaktu.</summary>
public sealed class GetExportRunDownloadUrlRequest
{
    public Guid Uuid { get; set; }
}

/// <summary>Adres pobrania artefaktu wraz z momentem wygaśnięcia linku.</summary>
/// <param name="Url">Adres ważny do <paramref name="ExpiresAt"/>.</param>
/// <param name="FileName">Nazwa, pod jaką plik ma się zapisać.</param>
/// <param name="ExpiresAt">Kiedy link przestaje działać.</param>
public sealed record ExportRunDownloadUrlResponse(string Url, string FileName, DateTimeOffset ExpiresAt);

/// <summary>Odczyty przebiegów eksportu.</summary>
public interface IExportRunQueries
{
    Task<SearchResponse> SearchAsync(SearchExportRunRequest request, CancellationToken cancellationToken);

    Task<List<ExportRunDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken);
}
