namespace TaskManagement.Domain.Boards;

/// <summary>Oś grupowania wierszy tablicy (BRD-006) — drugi wymiar nad tym samym mechanizmem
/// kolejności (§7): kolejność kart jest zachowana w obrębie swimlane'u, bez drugiego ranku.</summary>
public enum BoardSwimlaneMode
{
    /// <summary>Bez swimlane'ów — jedna lista na kolumnę, jak w fazie 2.</summary>
    None = 0,

    Assignee = 1,

    /// <summary>Najbliższy przodek typu <c>Epic</c> w hierarchii — nie cała ścieżka, tylko
    /// bezpośredni rodzic karty (uproszczenie: epik w praktyce jest bezpośrednim rodzicem
    /// zgłoszeń na tablicy wykonawczej, głębsze zagnieżdżenie na tablicy nie występuje).</summary>
    Epic = 2,

    Priority = 3,

    /// <summary>Pole niestandardowe typu <c>Select</c> (odpowiednik „Enum" z wymagania BRD-006)
    /// — <see cref="Board.SwimlaneFieldCode"/> niesie kod pola z profilu projektu.</summary>
    CustomField = 4,
}
