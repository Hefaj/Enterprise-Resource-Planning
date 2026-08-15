namespace Catalog.Application.Contracts;

using System.Collections.Generic;

// Kształt tych rekordów jest ZAMROŻONY: generuje z nich NSwag klienta TypeScript
// (frontend/libs/modules/catalog/data-access/src/lib/api-client.ts), a orkiestratory
// budują na nim swoje ViewModele. Zmiana nazwy albo typu pola to zmiana łamiąca dla frontendu
// i wymaga regeneracji klienta oraz przejrzenia orkiestratorów — nie robić mimochodem.

/// <summary>Odpowiedź wyszukiwania w drzewie kategorii.</summary>
public sealed class SearchCategoryTreeResponse
{
    public List<CategoryTreeNodeDto> Matches { get; set; } = [];

    /// <summary>Przodkowie trafień (bez duplikatów), żeby frontend mógł pokazać wynik
    /// w kontekście hierarchii bez dodatkowych zapytań.</summary>
    public List<CategoryTreeNodeDto> Ancestors { get; set; } = [];

    public int TotalCount { get; set; }
}
