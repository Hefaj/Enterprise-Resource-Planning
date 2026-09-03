using Erp.BuildingBlocks.Application.Abstractions;
using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Automation;

/// <summary>
/// Publikuje <see cref="IssueAutomationTriggerRequested"/> obok istniejących wywołań
/// <c>IssueNotificationPublisher</c> — ten sam wzorzec, ta sama korelacja. Jedno miejsce, żeby
/// propagacja głębokości łańcucha (AUT-001 AC3) nie rozjechała się między czterema punktami
/// publikacji (utworzenie, zmiana stanu, komentarz, upłynięcie terminu).
/// </summary>
public sealed class AutomationTriggerPublisher
{
    private readonly IIntegrationEventPublisher _publisher;

    public AutomationTriggerPublisher(IIntegrationEventPublisher publisher) => _publisher = publisher;

    public Task PublishAsync(
        Issue issue,
        AutomationTriggerKind triggerKind,
        IExecutionContext executionContext,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(issue);
        ArgumentNullException.ThrowIfNull(executionContext);

        // Kolejne wystąpienie triggerowane z WNĘTRZA wykonania reguły niesie głębokość rodzica
        // + 1 — silnik odrzuca ewaluację, gdy to przekroczy twardy limit (AutomationRuleEvaluator).
        var depth = executionContext.AutomationRuleUuid is null ? 0 : executionContext.AutomationDepth + 1;

        return _publisher.PublishAsync(
            new IssueAutomationTriggerRequested(
                issue.Uuid, issue.ProjectUuid, triggerKind, executionContext.CorrelationId, depth),
            ct);
    }
}
