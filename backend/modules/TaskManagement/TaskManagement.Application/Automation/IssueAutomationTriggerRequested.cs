using TaskManagement.Domain.Automation;

namespace TaskManagement.Application.Automation;

/// <summary>
/// Zdarzenie integracyjne wewnątrz-modułowe — <b>pierwsze takie w Task Management</b>. Dotąd
/// moduł publikował zdarzenia wyłącznie DLA innych modułów (<c>UserNotificationRequested</c>
/// do Notification, <c>ArtifactDeletionRequested</c> do siebie i Catalog po kluczu modułu).
/// Tu konsument (<c>AutomationTriggerHandler</c>) siedzi w tym samym module — świadomy wybór,
/// nie przeoczenie: to jedyny sposób, żeby ewaluacja warunku reguły widziała
/// <b>zatwierdzony</b> stan zgłoszenia, a nie stan sprzed <c>SaveChanges</c> komendy, która
/// wyzwoliła zdarzenie (patrz uzasadnienie przy <c>AutomationRuleEvaluator</c>).
///
/// <para>Kontrakt publiczny (choć nie opuszcza modułu) — wolno wyłącznie dodawać pola,
/// tak samo jak <c>ArtifactDeletionRequested</c>.</para>
/// </summary>
/// <param name="IssueUuid">Zgłoszenie, na którym warto sprawdzić reguły.</param>
/// <param name="ProjectUuid">Projekt zgłoszenia — reguły są zawsze projektowe.</param>
/// <param name="TriggerKind">Wyzwalacz, który uruchomił zdarzenie.</param>
/// <param name="CorrelationId">Korelacja operacji, która wyzwoliła zdarzenie — do logów, nie
/// do komend akcji (każda reguła dostaje własną korelację, AUT-001 AC2).</param>
/// <param name="AutomationDepth">Głębokość łańcucha automatyzacji, który doprowadził do tego
/// zdarzenia — <c>0</c>, gdy wyzwoliła je operacja człowieka. Silnik odrzuca ewaluację, gdy
/// przekracza twardy limit (AUT-001 AC3).</param>
public sealed record IssueAutomationTriggerRequested(
    Guid IssueUuid,
    Guid ProjectUuid,
    AutomationTriggerKind TriggerKind,
    Guid CorrelationId,
    int AutomationDepth);
