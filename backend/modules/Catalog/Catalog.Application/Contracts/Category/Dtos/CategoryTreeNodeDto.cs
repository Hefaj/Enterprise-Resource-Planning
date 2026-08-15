namespace Catalog.Application.Contracts;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

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
