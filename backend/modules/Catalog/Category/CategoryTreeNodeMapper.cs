using System;
using System.Collections.Generic;
using System.Linq;

namespace Catalog.Category;

/// <summary>Węzeł drzewa kategorii wzbogacony o metadane hierarchii wymagane przez
/// `erp-tree`/`erp-tree-picker` w trybie server (chevron/stan indeterminate bez pobierania
/// dzieci) — odpowiednik frontendowego `CategoryTreeNodeVM`.</summary>
public record CategoryTreeNodeDto(
    Guid Uuid,
    string Name,
    Guid? ParentUuid,
    bool HasChildren,
    int ChildCount,
    int DescendantCount
);

/// <summary>
/// Mapuje płaskie <see cref="CategoryDto"/> na <see cref="CategoryTreeNodeDto"/>, licząc
/// metadane hierarchii (dzieci/potomkowie) przez <see cref="CatalogMockData.CategoryChildren"/> —
/// indeks dziecko→rodzic zbudowany raz przy generacji danych, nie skanowany od nowa przy
/// każdym węźle. Przy tysiącach kategorii (patrz masowa gałąź testowa w `CatalogMockData`)
/// naiwne `Categories.Where(c => c.ParentUuid == x)` przy KAŻDYM wywołaniu kosztowałoby
/// O(rozmiar poddrzewa × liczba wszystkich kategorii) zamiast O(rozmiar poddrzewa).
///
/// W realnej bazie te liczniki liczy się jednym zapytaniem na tabeli domknięcia (closure table
/// `CategoryClosure(AncestorUuid, DescendantUuid, Depth)`) — patrz komentarz w
/// `GetCategoryChildren.cs`.
/// </summary>
public static class CategoryTreeNodeMapper
{
    public static CategoryTreeNodeDto ToNode(CategoryDto category)
    {
        var directChildCount = CatalogMockData.CategoryChildren[category.Uuid].Count();
        return new CategoryTreeNodeDto(
            category.Uuid,
            category.Name,
            category.ParentUuid,
            directChildCount > 0,
            directChildCount,
            CountDescendants(category.Uuid)
        );
    }

    private static int CountDescendants(Guid uuid)
    {
        var direct = CatalogMockData.CategoryChildren[uuid];
        var total = 0;
        foreach (var child in direct)
        {
            total += 1 + CountDescendants(child.Uuid);
        }
        return total;
    }

    /// <summary>Łańcuch przodków węzła, od najbliższego rodzica do korzenia (bez samego węzła) —
    /// używane przez `searchCategoryTree` do dołączenia kontekstu hierarchii do trafień.</summary>
    public static List<CategoryDto> AncestorsOf(Guid uuid)
    {
        var result = new List<CategoryDto>();
        var seen = new HashSet<Guid> { uuid };

        var current = CatalogMockData.CategoryByUuid.TryGetValue(uuid, out var self) ? self : null;
        while (current?.ParentUuid is { } parentUuid && seen.Add(parentUuid))
        {
            if (!CatalogMockData.CategoryByUuid.TryGetValue(parentUuid, out var parent))
                break;
            result.Add(parent);
            current = parent;
        }

        return result;
    }
}
