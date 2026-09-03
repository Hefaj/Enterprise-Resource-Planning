using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Webhooks;

namespace TaskManagement.Application.Webhooks;

/// <summary>Webhook w odczycie (API-004). <see cref="Secret"/> świadomie NIE wchodzi tutaj —
/// panel go nie pokazuje po zapisie, tylko przy tworzeniu/edycji przez to samo pole formularza
/// co URL; odczyt sekretu wstecz byłby furtką do jego wycieku bez żadnej wartości dla operatora
/// (podpis liczy dyspozytor, nie UI).</summary>
public sealed record WebhookDto(
    Guid Uuid,
    Guid ProjectUuid,
    string Url,
    IReadOnlyList<AutomationTriggerKind> EventKinds,
    bool IsEnabled,
    int ConsecutiveFailureCount,
    DateTimeOffset CreatedAt);

/// <summary>Dostarczenie w odczycie — panel „Dostarczenia” na karcie webhooka.</summary>
public sealed record WebhookDeliveryDto(
    Guid Uuid,
    Guid WebhookUuid,
    Guid IssueUuid,
    AutomationTriggerKind EventKind,
    WebhookDeliveryStatus Status,
    int AttemptCount,
    string? LastError,
    DateTimeOffset CreatedAt);

public sealed class SearchWebhookRequest
{
    public Guid ProjectUuid { get; set; }
}

/// <summary>Odczyty webhooków.</summary>
public interface IWebhookQueries
{
    Task<List<WebhookDto>> SearchAsync(SearchWebhookRequest request, CancellationToken cancellationToken);

    /// <summary>Ostatnie N dostarczeń jednego webhooka, najnowsze pierwsze — panel pod listą,
    /// wzorem <c>IAutomationRuleQueries.GetRecentRunsAsync</c>.</summary>
    Task<List<WebhookDeliveryDto>> GetRecentDeliveriesAsync(Guid webhookUuid, int limit, CancellationToken cancellationToken);
}
