namespace TaskManagement.Domain.Workflow;

using TaskManagement.Domain.Projects;

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
    public static readonly Guid IntakeSchemeUuid = new("0198f000-0000-7000-8000-000000000002");

    public static readonly Guid TodoStateUuid = new("0198f000-0000-7000-8000-000000000011");
    public static readonly Guid InProgressStateUuid = new("0198f000-0000-7000-8000-000000000012");
    public static readonly Guid DoneStateUuid = new("0198f000-0000-7000-8000-000000000013");

    public static readonly Guid IntakeSubmittedStateUuid = new("0198f000-0000-7000-8000-000000000021");
    public static readonly Guid IntakeInDeliveryStateUuid = new("0198f000-0000-7000-8000-000000000022");
    public static readonly Guid IntakeAcceptedStateUuid = new("0198f000-0000-7000-8000-000000000023");

    /// <summary>Kod wymagany przy odbiorze zlecenia. To wartość konfiguracji przejścia,
    /// zgodna z katalogiem <c>Erp.BuildingBlocks.Contracts.Permissions</c>; Domain nie zależy
    /// od kontraktów transportowych.</summary>
    public const string IntakeAcceptancePermission = "taskmgmt.project.manage";

    /// <summary>Domyślny schemat wybierany przy zakładaniu projektu bez własnej konfiguracji.</summary>
    public static Guid DefaultSchemeUuid(ProjectKind kind)
        => kind == ProjectKind.Intake ? IntakeSchemeUuid : SystemSchemeUuid;

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

    /// <summary>
    /// Automat dla rejestru zleceń. Stan <c>accepted</c> oznacza odbiór biznesowy, dlatego
    /// dojście do niego jest jawnym przejściem i niesie wymagane uprawnienie. Zmiana stanu
    /// realizacji po stronie Delivery nigdy nie wykonuje tego przejścia automatycznie.
    /// </summary>
    public static WorkflowScheme BuildIntake()
    {
        var scheme = WorkflowScheme.CreateWithUuid(IntakeSchemeUuid, "Zlecenie", isSystem: true);

        scheme.AddState(
            IntakeSubmittedStateUuid,
            "submitted",
            "taskManagement.workflow.states.submitted",
            WorkflowStateCategory.Todo,
            1);
        scheme.AddState(
            IntakeInDeliveryStateUuid,
            "in_delivery",
            "taskManagement.workflow.states.inDelivery",
            WorkflowStateCategory.InProgress,
            2);
        scheme.AddState(
            IntakeAcceptedStateUuid,
            "accepted",
            "taskManagement.workflow.states.accepted",
            WorkflowStateCategory.Done,
            3);

        AddPair(scheme, IntakeSubmittedStateUuid, IntakeInDeliveryStateUuid, "startDelivery", "returnToSubmitted");
        scheme.AddTransition(
            Guid.CreateVersion7(),
            IntakeInDeliveryStateUuid,
            IntakeAcceptedStateUuid,
            "taskManagement.workflow.transitions.accept",
            IntakeAcceptancePermission);
        scheme.AddTransition(
            Guid.CreateVersion7(),
            IntakeAcceptedStateUuid,
            IntakeInDeliveryStateUuid,
            "taskManagement.workflow.transitions.reopenAcceptance");

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
