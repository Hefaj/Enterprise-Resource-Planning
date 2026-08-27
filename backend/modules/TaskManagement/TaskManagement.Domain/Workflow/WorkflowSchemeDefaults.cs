namespace TaskManagement.Domain.Workflow;

/// <summary>
/// Schemat systemowy modułu — <b>stałe identyfikatory</b>, nie wiersze wyszukiwane po nazwie.
///
/// <para>Identyfikatory są tu jawnie, bo seed musi być powtarzalny między resetami bazy,
/// a projekt zakładany bez wskazania schematu musi mieć na co wskazać. Szukanie schematu
/// systemowego po nazwie („Domyślny”) łamie się przy pierwszym tłumaczeniu tej nazwy.</para>
///
/// <para>Faza 7 dokłada edytor schematów w UI — te wartości zostają wtedy tylko domyślną
/// konfiguracją dla nowego projektu, nie jedyną możliwą.</para>
/// </summary>
public static class WorkflowSchemeDefaults
{
    public static readonly Guid SystemSchemeUuid = new("0198f000-0000-7000-8000-000000000001");

    public static readonly Guid TodoStateUuid = new("0198f000-0000-7000-8000-000000000011");
    public static readonly Guid InProgressStateUuid = new("0198f000-0000-7000-8000-000000000012");
    public static readonly Guid DoneStateUuid = new("0198f000-0000-7000-8000-000000000013");

    /// <summary>Buduje schemat systemowy: trzy stany i przejścia w obie strony.
    /// Powrót <c>Done → In Progress</c> jest tu rutyną, nie sterowanym wyjątkiem —
    /// to jedna z różnic wobec obiegu w DMS (<c>docs/backend/task-management.md</c> §5.4).</summary>
    public static WorkflowScheme Build()
    {
        var scheme = WorkflowScheme.CreateWithUuid(SystemSchemeUuid, "Domyślny", isSystem: true);

        scheme.AddState(TodoStateUuid, "todo", "taskManagement.workflow.states.todo", WorkflowStateCategory.Todo, 1);
        scheme.AddState(
            InProgressStateUuid,
            "in_progress",
            "taskManagement.workflow.states.inProgress",
            WorkflowStateCategory.InProgress,
            2);
        scheme.AddState(DoneStateUuid, "done", "taskManagement.workflow.states.done", WorkflowStateCategory.Done, 3);

        AddPair(scheme, TodoStateUuid, InProgressStateUuid, "start", "return");
        AddPair(scheme, InProgressStateUuid, DoneStateUuid, "finish", "reopen");
        AddPair(scheme, TodoStateUuid, DoneStateUuid, "close", "reopenToTodo");

        return scheme;
    }

    private static void AddPair(WorkflowScheme scheme, Guid from, Guid to, string forwardKey, string backwardKey)
    {
        scheme.AddTransition(
            Guid.CreateVersion7(),
            from,
            to,
            $"taskManagement.workflow.transitions.{forwardKey}");

        scheme.AddTransition(
            Guid.CreateVersion7(),
            to,
            from,
            $"taskManagement.workflow.transitions.{backwardKey}");
    }
}
