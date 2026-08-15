namespace Catalog.Application.Multimedia;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

/// <summary>Zasób multimedialny.</summary>
public sealed record MultimediaDto(
    Guid Uuid,
    string FileName,
    string MediaType,
    string? ThumbnailUrl,
    string OriginalUrl,
    long FileSize,
    string MimeType,
    int SortOrder,
    DateTime CreatedAt);
