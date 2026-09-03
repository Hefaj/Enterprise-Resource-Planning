using TaskManagement.Application.Automation;

namespace TaskManagement.Infrastructure.Consumers;

/// <summary>
/// Konsument <see cref="IssueAutomationTriggerRequested"/> — wzorem
/// <c>ArtifactDeletionRequestedHandler</c>, tyle że nadawca i odbiorca leżą w tym samym module
/// (patrz uzasadnienie przy zdarzeniu). Wykonuje się dopiero PO zatwierdzeniu transakcji komendy,
/// która wyzwoliła trigger — ewaluacja warunku reguły widzi zawsze zatwierdzony stan zgłoszenia.
/// </summary>
public static class AutomationTriggerHandler
{
    public static Task HandleAsync(
        IssueAutomationTriggerRequested message,
        IAutomationRuleEvaluator evaluator,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);
        ArgumentNullException.ThrowIfNull(evaluator);

        return evaluator.EvaluateAsync(message, cancellationToken);
    }
}
