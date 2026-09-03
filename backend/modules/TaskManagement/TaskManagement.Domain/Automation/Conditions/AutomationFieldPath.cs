namespace TaskManagement.Domain.Automation.Conditions;

/// <summary>
/// Whitelista pól dostępnych w warunku reguły (AUT-001 `if`) — wąski język „ten sam co `guard`"
/// (WF-003/DMS §4.4): tylko te ścieżki, żadnej dowolnej. Pola niestandardowe (zależne od profilu
/// pól projektu) są świadomie poza zakresem — udokumentowane ograniczenie, nie cichy brak.
/// </summary>
public static class AutomationFieldPath
{
    public const string Priority = "priority";
    public const string Type = "type";
    public const string State = "state";
    public const string StateCategory = "state.category";
    public const string Assignee = "assignee";

    /// <summary>„Ma tag" — jedyne pole wielowartościowe; tylko <see cref="AutomationComparisonOperator.Eq"/>
    /// ma sens (patrz <see cref="AutomationConditionValidator"/>).</summary>
    public const string Tag = "tag";

    /// <summary>Pola porównywalne jako enum tekstem (<c>"High"</c>, <c>"Done"</c>) — wspierają
    /// wszystkie sześć operatorów, bo kategorie/priorytety mają naturalny porządek.</summary>
    public static readonly IReadOnlySet<string> EnumFields = new HashSet<string> { Priority, StateCategory };

    /// <summary>Pola-referencje (uuid) — tylko równość/różność ma sens, „większy priorytet niż
    /// ten konkretny stan" nie znaczy nic.</summary>
    public static readonly IReadOnlySet<string> ReferenceFields = new HashSet<string> { Type, State, Assignee, Tag };

    public static readonly IReadOnlySet<string> All = new HashSet<string>(EnumFields.Concat(ReferenceFields));
}
