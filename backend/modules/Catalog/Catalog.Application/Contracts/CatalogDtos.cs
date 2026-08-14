namespace Catalog.Application.Contracts;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

/// <summary>Kategoria katalogu w widoku płaskim.</summary>
public sealed record CategoryDto(
    Guid Uuid,
    string Name,
    Guid? ParentUuid);

/// <summary>
/// Węzeł drzewa kategorii wzbogacony o metadane hierarchii wymagane przez <c>erp-tree</c>
/// i <c>erp-tree-picker</c> w trybie server — chevron i stan pośredni bez pobierania dzieci.
/// Odpowiednik frontendowego <c>CategoryTreeNodeVM</c>.
/// </summary>
public sealed record CategoryTreeNodeDto(
    Guid Uuid,
    string Name,
    Guid? ParentUuid,
    bool HasChildren,
    int ChildCount,
    int DescendantCount);

/// <summary>Model produktu.</summary>
public sealed record ModelDto(
    Guid Uuid,
    string Name);

/// <summary>Gwarancja przypisana do produktu wraz z faktycznym okresem.</summary>
public sealed record ProductWarrantyDto(
    Guid WarrantyUuid,
    int DurationMonths);

/// <summary>Definicja gwarancji z katalogu.</summary>
public sealed record WarrantyDto(
    Guid Uuid,
    string Name,
    int DurationMonths,
    string Description);

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

// CA1707 (podkreślenia w nazwach) jest tu wyłączone świadomie i punktowo: `Attr_Weight`
// i `Attr_Color` to istniejące nazwy pól kontraktu API, konsumowane przez wygenerowanego
// klienta na frontendzie. Zmiana nazwy dla zgodności z konwencją .NET zepsułaby frontend
// bez żadnej korzyści funkcjonalnej. Docelowo oba pola zastąpi słownik atrybutów.
#pragma warning disable CA1707

/// <summary>Produkt katalogu.</summary>
public sealed record ProductDto(
    Guid Uuid,
    string Name,
    List<Guid> CategoryUuids,
    List<Guid> MultimediaUuids,
    List<ProductWarrantyDto> Warranties,
    Guid? ModelUuid,
    string Sku,
    decimal Price,
    DateTime? AvailableFrom,
    string Status,
    bool Available,
    string Ean,
    string? Image,
    string Attr_Weight,
    string Attr_Color);

#pragma warning restore CA1707

/// <summary>Odpowiedź na stronicowane pobranie dzieci węzła drzewa.</summary>
public sealed class GetCategoryChildrenResponse
{
    public List<CategoryTreeNodeDto> Nodes { get; set; } = [];

    public int TotalCount { get; set; }
}

/// <summary>Odpowiedź wyszukiwania w drzewie kategorii.</summary>
public sealed class SearchCategoryTreeResponse
{
    public List<CategoryTreeNodeDto> Matches { get; set; } = [];

    /// <summary>Przodkowie trafień (bez duplikatów), żeby frontend mógł pokazać wynik
    /// w kontekście hierarchii bez dodatkowych zapytań.</summary>
    public List<CategoryTreeNodeDto> Ancestors { get; set; } = [];

    public int TotalCount { get; set; }
}
