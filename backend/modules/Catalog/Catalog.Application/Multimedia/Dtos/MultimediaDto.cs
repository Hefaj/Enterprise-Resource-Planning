namespace Catalog.Application.Multimedia;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

/// <summary>
/// Zasób multimedialny.
///
/// <para><b>Adres zawartości nie jedzie w tym DTO.</b> Dla zasobu wgranego do systemu
/// <see cref="OriginalUrl"/> jest pusty, a bajty wydaje endpoint <c>multimedia/content/{uuid}</c>
/// — adresowany identyfikatorem zasobu, nie artefaktu, żeby tożsamość obiektu w magazynie
/// w ogóle nie wychodziła na zewnątrz. Wypełniony <see cref="OriginalUrl"/> oznacza zasób
/// spoza systemu i wtedy to on jest adresem.</para>
/// </summary>
public sealed record MultimediaDto(
    Guid Uuid,
    string FileName,
    string MediaType,
    string? ThumbnailUrl,
    string? OriginalUrl,
    long FileSize,
    string MimeType,
    int SortOrder,
    DateTime CreatedAt);
