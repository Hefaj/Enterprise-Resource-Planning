namespace TaskManagement.Domain.Workflow;

/// <summary>
/// Kategoria stanu — <b>po niej</b> liczą raporty i po niej tablica wie, że karta „wyszła
/// z pracy”, a nie po nazwie stanu. Dzięki temu projekt może mieć stan „Czeka na zamówienie
/// sprzętu” i nadal poprawnie liczyć czas realizacji (patrz
/// <c>docs/modules/task-management/domain.md</c> §5.1).
/// </summary>
public enum WorkflowStateCategory
{
    Todo = 0,
    InProgress = 1,
    Done = 2,
}
