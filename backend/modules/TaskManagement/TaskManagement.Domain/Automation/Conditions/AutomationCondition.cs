namespace TaskManagement.Domain.Automation.Conditions;

/// <summary>
/// AST warunku reguły — dysjunkcja grup koniunkcji (DNF): <c>(A and B) or (C and D)</c>,
/// bez zagnieżdżonych nawiasów, zgodnie z „wąsko" (WF-003/DMS §4.4: porównania, `and`/`or`,
/// ścieżka do pola, literały — nic więcej). Pusta lista grup = warunek zawsze prawdziwy
/// (reguła bez `if`, wykonuje się na każde wystąpienie wyzwalacza).
/// </summary>
public sealed record AutomationCondition(IReadOnlyList<IReadOnlyList<AutomationComparison>> Groups)
{
    public static readonly AutomationCondition Always = new([]);

    public bool IsAlways => Groups.Count == 0;
}
