using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Catalog.Common;

/// <summary>
/// Deskryptor dowolnego zaznaczenia w drzewie — odpowiednik `ErpTreeSelectionValue` z frontendu
/// (<c>erp-tree-selection.model.ts</c>). Zamiast płaskiej listy uuid (nieskalowalnej — zaznaczenie
/// korzenia z tysiącami potomków nie może wymagać wypisania ich wszystkich w request body), request
/// niesie deskryptor: pojedyncze znaczniki (<see cref="Ids"/>) obok poddrzew z wyjątkami
/// (<see cref="SubtreeRoots"/>/<see cref="Excluded"/>). Rozstrzygnięcie przynależności konkretnego
/// węzła do zaznaczenia wymaga znajomości hierarchii (mapy dziecko→rodzic) — patrz
/// <see cref="TreeSelectionResolver"/>.
///
/// Wzorcowy request-side model do wielokrotnego użycia przy innych filtrach drzewiastych
/// (kategorie, struktura magazynów, drzewo zadań itp.) — nie tworzyć ad-hoc odpowiedników per moduł.
/// </summary>
public class TreeSelectionRequest
{
    /// <summary>Niezależnie zaznaczone węzły — zawsze włączone, bez względu na SubtreeRoots/Excluded.</summary>
    public List<Guid> Ids { get; set; } = new();

    /// <summary>Korzenie zaznaczonych poddrzew (kaskadowo obejmują potomków).</summary>
    public List<Guid> SubtreeRoots { get; set; } = new();

    /// <summary>Wykluczenia (carve-outs) wewnątrz zaznaczonych poddrzew — w tym wzorzec
    /// „poddrzewo X bez samego X”: <c>SubtreeRoots: [X], Excluded: [X]</c>.</summary>
    public List<Guid> Excluded { get; set; } = new();

    /// <summary>Pomocnicze — wyłącznie po stronie serwera, nie część kontraktu (nie serializować).</summary>
    [JsonIgnore]
    public bool IsEmpty => Ids.Count == 0 && SubtreeRoots.Count == 0 && Excluded.Count == 0;
}
