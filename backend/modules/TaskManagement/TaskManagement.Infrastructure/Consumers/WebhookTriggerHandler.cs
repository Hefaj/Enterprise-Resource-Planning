using TaskManagement.Application.Webhooks;

namespace TaskManagement.Infrastructure.Consumers;

/// <summary>
/// Konsument <see cref="IssueWebhookTriggerRequested"/> — wzorem <c>AutomationTriggerHandler</c>,
/// nadawca i odbiorca leżą w tym samym module. Wykonuje się dopiero PO zatwierdzeniu transakcji
/// komendy, która wyzwoliła trigger, więc widzi zawsze zatwierdzony stan zgłoszenia.
/// </summary>
public static class WebhookTriggerHandler
{
    public static Task HandleAsync(
        IssueWebhookTriggerRequested message,
        IWebhookDispatchService dispatch,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(message);
        ArgumentNullException.ThrowIfNull(dispatch);

        return dispatch.EnqueueAsync(message, cancellationToken);
    }
}
