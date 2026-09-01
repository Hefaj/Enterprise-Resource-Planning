namespace TaskManagement.Domain.Workflow;

/// <summary>
/// Schemat systemowy dla projektów <c>Intake</c> — zamawiający składa zlecenie, dział je
/// przyjmuje i realizuje, zamawiający odbiera (<c>docs/backend/task-management.md</c> §9,
/// REQ-004 AC3).
///
/// <para>Osobny schemat od <see cref="WorkflowSchemeDefaults"/>, nie parametr tego samego:
/// zlecenie ma inny cykl życia niż zadanie wykonawcze — „odebrane" jest decyzją zamawiającego,
/// nie stanem symetrycznym do „zrobione". Do fazy 5 oba rodzaje projektów dostawały ten sam
/// schemat systemowy, co było uproszczeniem tymczasowym — teraz każdy rodzaj ma własny.</para>
/// </summary>
public static class IntakeSchemeDefaults
{
    public static readonly Guid SchemeUuid = new("0198f000-0000-7000-8000-000000000002");

    public static readonly Guid NewStateUuid = new("0198f000-0000-7000-8000-000000000021");
    public static readonly Guid AcceptedStateUuid = new("0198f000-0000-7000-8000-000000000022");
    public static readonly Guid InProgressStateUuid = new("0198f000-0000-7000-8000-000000000023");
    public static readonly Guid AwaitingPickupStateUuid = new("0198f000-0000-7000-8000-000000000024");
    public static readonly Guid DeliveredStateUuid = new("0198f000-0000-7000-8000-000000000025");

    /// <summary>Buduje schemat: pięć stanów w łańcuchu, plus „Zastrzeżenia" — jedyne przejście
    /// wsteczne, z powrotem do realizacji, gdy zamawiający nie odbiera pracy bez uwag.</summary>
    public static WorkflowScheme Build()
    {
        var scheme = WorkflowScheme.CreateWithUuid(SchemeUuid, "Zlecenia", isSystem: true);

        scheme.AddState(NewStateUuid, "new", "taskManagement.workflow.intake.states.new", WorkflowStateCategory.Todo, 1);
        scheme.AddState(AcceptedStateUuid, "accepted", "taskManagement.workflow.intake.states.accepted", WorkflowStateCategory.Todo, 2);
        scheme.AddState(InProgressStateUuid, "in_progress", "taskManagement.workflow.intake.states.inProgress", WorkflowStateCategory.InProgress, 3);
        scheme.AddState(AwaitingPickupStateUuid, "awaiting_pickup", "taskManagement.workflow.intake.states.awaitingPickup", WorkflowStateCategory.InProgress, 4);
        scheme.AddState(DeliveredStateUuid, "delivered", "taskManagement.workflow.intake.states.delivered", WorkflowStateCategory.Done, 5);

        scheme.AddTransition(Guid.CreateVersion7(), NewStateUuid, AcceptedStateUuid, "taskManagement.workflow.intake.transitions.accept");
        scheme.AddTransition(Guid.CreateVersion7(), AcceptedStateUuid, InProgressStateUuid, "taskManagement.workflow.intake.transitions.start");
        scheme.AddTransition(Guid.CreateVersion7(), InProgressStateUuid, AwaitingPickupStateUuid, "taskManagement.workflow.intake.transitions.finish");

        // Odbiór jest zawsze decyzją zamawiającego, nigdy skutkiem ubocznym zamknięcia
        // ostatniej realizacji — to zlecenie zamyka SIĘ, `Issue.DerivedDeliveryState` tylko
        // podpowiada, że jest gotowe (REQ-003).
        scheme.AddTransition(Guid.CreateVersion7(), AwaitingPickupStateUuid, DeliveredStateUuid, "taskManagement.workflow.intake.transitions.deliver");

        // Zastrzeżenia — jedyne przejście wsteczne, wraca do realizacji, nie do „nowego".
        scheme.AddTransition(Guid.CreateVersion7(), AwaitingPickupStateUuid, InProgressStateUuid, "taskManagement.workflow.intake.transitions.reservations");

        return scheme;
    }
}
