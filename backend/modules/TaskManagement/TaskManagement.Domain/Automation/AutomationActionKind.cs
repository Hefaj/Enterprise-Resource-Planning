namespace TaskManagement.Domain.Automation;

/// <summary>Rodzaj akcji reguły automatyzacji (AUT-001 `then`) — <b>zamknięta, typowana lista</b>,
/// żadnych skryptów (AC1, patrz `docs/modules/task-management/requirements.md` §24.9).</summary>
public enum AutomationActionKind
{
    SetPriority = 0,
    SetState = 1,
    AssignTo = 2,
    AddTag = 3,
    AddComment = 4,
    SendNotification = 5,
    CreateSubtask = 6,
}
