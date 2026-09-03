using Erp.BuildingBlocks.Application.Abstractions;
using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Webhooks;

/// <summary>
/// Publikuje <see cref="IssueWebhookTriggerRequested"/> obok istniejących wywołań
/// <c>AutomationTriggerPublisher</c> w tych samych trzech punktach cyklu życia zgłoszenia
/// (utworzenie, zmiana stanu, komentarz) — API-004 opisuje dokładnie ten zestaw, bez
/// upłynięcia terminu. Osobna klasa od <c>AutomationTriggerPublisher</c>, nie rozszerzenie:
/// automatyzacja i webhooki to dwa niezależne mechanizmy reagowania na to samo zdarzenie,
/// z osobnymi odbiorcami (silnik reguł kontra dyspozytor HTTP) i osobną historią zmian —
/// wspólny punkt publikacji tylko po to, żeby drugi zapomniany call site nie rozjechał
/// zestawu wyzwalanych zdarzeń między automatyzacją a webhookami.
/// </summary>
public sealed class WebhookTriggerPublisher
{
    private readonly IIntegrationEventPublisher _publisher;

    public WebhookTriggerPublisher(IIntegrationEventPublisher publisher) => _publisher = publisher;

    public Task PublishAsync(
        Issue issue, AutomationTriggerKind triggerKind, IExecutionContext executionContext, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(issue);
        ArgumentNullException.ThrowIfNull(executionContext);

        return _publisher.PublishAsync(
            new IssueWebhookTriggerRequested(
                issue.Uuid, issue.ProjectUuid, triggerKind, executionContext.CorrelationId),
            ct);
    }
}
