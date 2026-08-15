using Erp.BuildingBlocks.Domain;

namespace Catalog.Domain.Multimedia;

/// <summary>
/// Zasób multimedialny (zdjęcie, wideo) — osobny agregat, nie pole produktu.
///
/// Uzasadnienie granicy, wg kryteriów z sekcji 9 <c>docs/frontend/orchestrators.md</c>:
/// ma własny endpoint, bywa ładowany niezależnie od produktu (flaga <c>includeMultimedia</c>),
/// jest współdzielony między agregatami i ma własny cykl życia (upload, usunięcie).
/// Frontend potwierdza tę granicę osobnym orkiestratorem o sygnaturze <c>catalog.multimedia</c>.
/// </summary>
public class MultimediaAsset : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected MultimediaAsset()
    {
    }

    private MultimediaAsset(
        Guid uuid,
        string fileName,
        string mediaType,
        string? thumbnailUrl,
        string originalUrl,
        long fileSize,
        string mimeType,
        int sortOrder,
        DateTimeOffset createdAt) : base(uuid)
    {
        FileName = fileName;
        MediaType = mediaType;
        ThumbnailUrl = thumbnailUrl;
        OriginalUrl = originalUrl;
        FileSize = fileSize;
        MimeType = mimeType;
        SortOrder = sortOrder;
        CreatedAt = createdAt;
    }

    public string FileName { get; private set; } = string.Empty;

    /// <summary>Rodzaj zasobu w ujęciu ogólnym (<c>image</c>, <c>video</c>).</summary>
    public string MediaType { get; private set; } = string.Empty;

    public string? ThumbnailUrl { get; private set; }

    public string OriginalUrl { get; private set; } = string.Empty;

    public long FileSize { get; private set; }

    public string MimeType { get; private set; } = string.Empty;

    /// <summary>Kolejność prezentacji w galerii.</summary>
    public int SortOrder { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static MultimediaAsset Create(
        string fileName,
        string mediaType,
        string? thumbnailUrl,
        string originalUrl,
        long fileSize,
        string mimeType,
        int sortOrder,
        DateTimeOffset createdAt)
        => new(NewUuid(), Validate(fileName), mediaType, thumbnailUrl, originalUrl,
               ValidateSize(fileSize), mimeType, sortOrder, createdAt);

    /// <inheritdoc cref="Categories.Category.CreateWithUuid"/>
    public static MultimediaAsset CreateWithUuid(
        Guid uuid,
        string fileName,
        string mediaType,
        string? thumbnailUrl,
        string originalUrl,
        long fileSize,
        string mimeType,
        int sortOrder,
        DateTimeOffset createdAt)
        => new(uuid, Validate(fileName), mediaType, thumbnailUrl, originalUrl,
               ValidateSize(fileSize), mimeType, sortOrder, createdAt);

    /// <summary>Zmienia pozycję zasobu w galerii.</summary>
    public void Reorder(int sortOrder)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(sortOrder);
        SortOrder = sortOrder;
    }

    private static string Validate(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            throw new DomainException("multimedia_filename_empty", "Nazwa pliku nie może być pusta.");
        }

        return fileName.Trim();
    }

    private static long ValidateSize(long fileSize)
    {
        if (fileSize < 0)
        {
            throw new DomainException("multimedia_size_invalid", "Rozmiar pliku nie może być ujemny.");
        }

        return fileSize;
    }
}
