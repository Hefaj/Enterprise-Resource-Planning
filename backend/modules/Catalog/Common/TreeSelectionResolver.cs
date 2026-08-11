using System;
using System.Collections.Generic;
using System.Linq;

namespace Catalog.Common;

/// <summary>
/// Rozstrzyga przynależność węzła drzewa do zaznaczenia opisanego przez <see cref="TreeSelectionRequest"/>.
/// Port logiki z frontendowego <c>erp-tree-selection.model.ts</c> (<c>isNodeIncluded</c> +
/// <c>resolveAncestorCoverage</c>) na backend — wzorcowy sposób pracy z drzewami po tej stronie:
/// hierarchia NIGDY nie jest materializowana do płaskiej listy id przekazywanej w request body,
/// tylko przechodzona w górę (dziecko → rodzic) przy rozstrzyganiu pojedynczego węzła.
///
/// Reguła włączenia węzła (w kolejności rozstrzygania):
///  1. Węzeł jest jawnie zaznaczony (<see cref="TreeSelectionRequest.Ids"/>) → zawsze włączony,
///     niezależnie od poddrzew/wykluczeń. To rozszerzenie względem frontendu (tam `ids` i
///     `subtreeRoots/excluded` są rozłączne — jeden tryb selekcji naraz); tu obsługujemy oba
///     jednocześnie, żeby resolver pokrywał najbardziej złożony/mieszany przypadek.
///  2. Sam węzeł: `Excluded` rozstrzyga przed `SubtreeRoots` (węzeł jednocześnie będący korzeniem
///     poddrzewa i wykluczeniem — wzorzec „poddrzewo X bez samego X” — jest dla SIEBIE wykluczony).
///  3. W przeciwnym razie idziemy w górę do korzenia (rodzic, dziadek, …): na każdym przodku
///     `SubtreeRoots` rozstrzyga PRZED `Excluded` — odwrotna kolejność niż dla samego węzła. Dzięki
///     temu potomek węzła z wzorca „X bez samego X” trafia na `SubtreeRoots` u X, zanim jego własne
///     ewentualne wykluczenie u X zostałoby wzięte pod uwagę, i zostaje poprawnie włączony. Bliższy
///     przodek na ścieżce zawsze wygrywa nad dalszym.
///
/// Wydajność: dla filtrowania kolekcji encji po zaznaczeniu drzewa NIE wywołuj tego resolvera
/// per encja — drzewo kategorii/węzłów jest zwykle małe i ograniczone (dziesiątki–setki węzłów),
/// więc <see cref="ResolveIncludedIds"/> materializuje zbiór włączonych uuid RAZ, a filtrowanie
/// właściwej (potencjalnie dużej) kolekcji sprowadza się do taniego <c>HashSet.Contains</c> per wiersz.
/// </summary>
public static class TreeSelectionResolver
{
    private const int MaxAncestorDepth = 128;

    public static bool IsIncluded(Guid nodeUuid, TreeSelectionRequest selection, IReadOnlyDictionary<Guid, Guid?> parentByUuid)
    {
        if (selection.Ids.Contains(nodeUuid))
            return true;

        if (selection.Excluded.Contains(nodeUuid))
            return false;
        if (selection.SubtreeRoots.Contains(nodeUuid))
            return true;

        var visited = new HashSet<Guid> { nodeUuid };
        var depth = 0;
        Guid? current = parentByUuid.TryGetValue(nodeUuid, out var parent) ? parent : null;

        while (current.HasValue && depth++ < MaxAncestorDepth && visited.Add(current.Value))
        {
            if (selection.SubtreeRoots.Contains(current.Value))
                return true;
            if (selection.Excluded.Contains(current.Value))
                return false;

            current = parentByUuid.TryGetValue(current.Value, out var next) ? next : null;
        }

        return false;
    }

    /// <summary>Materializuje pełen zbiór uuid włączonych przez zaznaczenie — do jednorazowego
    /// wyliczenia przed filtrowaniem właściwej kolekcji encji (patrz uwaga o wydajności wyżej).</summary>
    public static HashSet<Guid> ResolveIncludedIds(IEnumerable<Guid> allNodeUuids, TreeSelectionRequest selection, IReadOnlyDictionary<Guid, Guid?> parentByUuid)
    {
        return allNodeUuids.Where(uuid => IsIncluded(uuid, selection, parentByUuid)).ToHashSet();
    }
}
