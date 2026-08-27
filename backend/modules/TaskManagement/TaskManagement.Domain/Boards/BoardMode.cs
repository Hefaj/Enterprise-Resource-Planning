namespace TaskManagement.Domain.Boards;

/// <summary>
/// Tryb tablicy. <c>Kanban</c> pokazuje wszystkie karty spełniające filtr, <c>Scrum</c> —
/// wyłącznie karty przypisane do aktywnego sprintu (sprinty wchodzą w fazie 6, dlatego
/// kolumna <c>sprint_uuid</c> na karcie jest od fazy 2 pusta).
/// </summary>
public enum BoardMode
{
    Kanban = 0,
    Scrum = 1,
}
