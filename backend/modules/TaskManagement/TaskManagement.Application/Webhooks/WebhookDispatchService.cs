using Erp.BuildingBlocks.Application.Abstractions;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Webhooks;

namespace TaskManagement.Application.Webhooks;

/// <summary>Tworzy wiersze <see cref="WebhookDelivery"/> dla webhooków projektu zapisanych na
/// dany trigger — wołane przez <c>WebhookTriggerHandler</c> z konsumenta outboxu. Samo
/// dostarczenie (HTTP) jest sprawą <c>WebhookDeliveryDispatcher</c> w tle — ten serwis tylko
/// stawia zadanie w kolejce, zgodnie z API-004 AC1 (nie z transakcji komendy).</summary>
public interface IWebhookDispatchService
{
    Task EnqueueAsync(IssueWebhookTriggerRequested trigger, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookDispatchService"/>
public sealed class WebhookDispatchService : IWebhookDispatchService
{
    private readonly IWebhookRepository _webhooks;
    private readonly IWebhookDeliveryRepository _deliveries;
    private readonly IIssueRepository _issues;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClock _clock;

    public WebhookDispatchService(
        IWebhookRepository webhooks,
        IWebhookDeliveryRepository deliveries,
        IIssueRepository issues,
        IUnitOfWork unitOfWork,
        IClock clock)
    {
        _webhooks = webhooks;
        _deliveries = deliveries;
        _issues = issues;
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    /// <inheritdoc />
    public async Task EnqueueAsync(IssueWebhookTriggerRequested trigger, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(trigger);

        var projectWebhooks = await _webhooks
            .FindByProjectAsync(trigger.ProjectUuid, cancellationToken)
            .ConfigureAwait(false);

        var matching = projectWebhooks.Where(w => w.Subscribes(trigger.TriggerKind)).ToList();

        if (matching.Count == 0)
        {
            return;
        }

        var issue = await _issues.FindAsync(trigger.IssueUuid, cancellationToken).ConfigureAwait(false);

        if (issue is null)
        {
            // Wyścig: zgłoszenie zniknęło między publikacją triggera a przetworzeniem zdarzenia
            // (np. usunięte w międzyczasie) — nic do dostarczenia, nie jest to błąd.
            return;
        }

        var now = _clock.UtcNow;
        var payload = WebhookPayloadBuilder.Build(issue, trigger.TriggerKind, trigger.CorrelationId, now);

        foreach (var webhook in matching)
        {
            _deliveries.Add(WebhookDelivery.CreateWithUuid(
                Guid.CreateVersion7(), webhook.Uuid, issue.Uuid, trigger.TriggerKind, payload, now));
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
