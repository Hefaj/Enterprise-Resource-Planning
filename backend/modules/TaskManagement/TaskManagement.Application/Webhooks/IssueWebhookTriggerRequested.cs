using TaskManagement.Domain.Automation;

namespace TaskManagement.Application.Webhooks;

/// <summary>
/// Zdarzenie integracyjne wewnątrz-modułowe — konsument (<c>WebhookTriggerHandler</c>) siedzi
/// w tym samym module, dokładnie wzorem <c>IssueAutomationTriggerRequested</c>: chce widzieć
/// ZATWIERDZONY stan zgłoszenia po komendzie, która wyzwoliła zdarzenie, nie stan sprzed
/// <c>SaveChanges</c>. W odróżnieniu od triggera automatyzacji nie niesie głębokości łańcucha —
/// webhooki nie wywołują się nawzajem (dostarczenie to POST na zewnątrz, nie komenda na
/// zgłoszeniu, więc nie ma czego rekursywnie triggerować).
///
/// <para>Kontrakt publiczny (choć nie opuszcza modułu) — wolno wyłącznie dodawać pola.</para>
/// </summary>
/// <param name="IssueUuid">Zgłoszenie, które wywołało zdarzenie.</param>
/// <param name="ProjectUuid">Projekt zgłoszenia — webhooki są zawsze projektowe.</param>
/// <param name="TriggerKind">Zdarzenie cyklu życia, które wywołało trigger.</param>
/// <param name="CorrelationId">Korelacja operacji, która wyzwoliła zdarzenie — do logów.</param>
public sealed record IssueWebhookTriggerRequested(
    Guid IssueUuid,
    Guid ProjectUuid,
    AutomationTriggerKind TriggerKind,
    Guid CorrelationId);
