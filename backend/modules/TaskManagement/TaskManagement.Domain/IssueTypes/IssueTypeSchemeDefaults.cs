namespace TaskManagement.Domain.IssueTypes;

/// <summary>
/// Schemat systemowy typów zgłoszeń — <b>stałe identyfikatory</b>, tak samo jak
/// <see cref="Workflow.WorkflowSchemeDefaults"/>: seed musi być powtarzalny między resetami
/// bazy, a projekt zakładany bez wskazania schematu musi mieć na co wskazać
/// (<c>docs/backend/task-management-requirements.md</c> TYP-002).
///
/// <para>Pięć typów: <c>Epik</c> (Epic), <c>Funkcjonalność</c>/<c>Zadanie</c>/<c>Błąd</c>
/// (Standard), <c>Podzadanie</c> (Subtask) — dokładnie tyle, ile trzeba, żeby zademonstrować
/// wszystkie trzy kategorie i typowy zestaw startowy zespołu wykonawczego.</para>
/// </summary>
public static class IssueTypeSchemeDefaults
{
    public static readonly Guid SystemSchemeUuid = new("0198f000-0000-7000-8000-000000000021");

    public static readonly Guid EpicTypeUuid = new("0198f000-0000-7000-8000-000000000031");
    public static readonly Guid FeatureTypeUuid = new("0198f000-0000-7000-8000-000000000032");
    public static readonly Guid TaskTypeUuid = new("0198f000-0000-7000-8000-000000000033");
    public static readonly Guid BugTypeUuid = new("0198f000-0000-7000-8000-000000000034");
    public static readonly Guid SubtaskTypeUuid = new("0198f000-0000-7000-8000-000000000035");

    /// <summary>Buduje schemat systemowy: cztery typy widoczne w modalu tworzenia
    /// (<c>Epik</c>/<c>Funkcjonalność</c>/<c>Zadanie</c>/<c>Błąd</c>) i jeden dostępny wyłącznie
    /// z karty zgłoszenia (<c>Podzadanie</c>) — dokładnie tak, jak <see cref="IssueTypeScheme.DefaultType"/>
    /// wybiera domyślny typ spośród kategorii <see cref="IssueTypeCategory.Standard"/>.</summary>
    public static IssueTypeScheme Build()
    {
        var scheme = IssueTypeScheme.CreateWithUuid(SystemSchemeUuid, "Systemowy", isSystem: true);

        scheme.AddType(
            EpicTypeUuid, "epic", "Epik", "taskManagement.issueTypes.epic",
            "tuiIconLayers", IssueTypeCategory.Epic, orderNo: 0);

        scheme.AddType(
            FeatureTypeUuid, "feature", "Funkcjonalność", "taskManagement.issueTypes.feature",
            "tuiIconBookmark", IssueTypeCategory.Standard, orderNo: 1);

        scheme.AddType(
            TaskTypeUuid, "task", "Zadanie", "taskManagement.issueTypes.task",
            "tuiIconCheckSquare", IssueTypeCategory.Standard, orderNo: 2);

        scheme.AddType(
            BugTypeUuid, "bug", "Błąd", "taskManagement.issueTypes.bug",
            "tuiIconAlertCircle", IssueTypeCategory.Standard, orderNo: 3);

        scheme.AddType(
            SubtaskTypeUuid, "subtask", "Podzadanie", "taskManagement.issueTypes.subtask",
            "tuiIconCornerDownRight", IssueTypeCategory.Subtask, orderNo: 4);

        return scheme;
    }
}
