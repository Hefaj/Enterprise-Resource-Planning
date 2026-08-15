namespace Catalog.Application.Categories;

using System.Collections.Generic;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

/// <summary>Odpowiedź na stronicowane pobranie dzieci węzła drzewa.</summary>
public sealed class GetCategoryChildrenResponse
{
    public List<CategoryTreeNodeDto> Nodes { get; set; } = [];

    public int TotalCount { get; set; }
}
