namespace TaskManagement.Domain.Automation;

/// <summary>Zdarzenie, które uruchamia ewaluację reguł automatyzacji (AUT-001 `when`).
/// Zamknięty zestaw — nowy wyzwalacz to zmiana kodu, nie konfiguracji, tak samo jak zamknięta
/// lista akcji (<see cref="AutomationActionKind"/>).</summary>
public enum AutomationTriggerKind
{
    IssueCreated = 0,
    IssueStateChanged = 1,
    CommentAdded = 2,

    /// <summary>Zgłoszenie minęło termin (nie „zbliża się" — to byłby drugi, częstszy sygnał
    /// bez wartości dla automatyzacji, patrz <c>IssueOverdueScanService</c>).</summary>
    DueDateElapsed = 3,
}
