using FastEndpoints;
using TaskManagement.Application.Webhooks;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Webhooks.Query;

/// <summary>Log ostatnich dostarczeń jednego webhooka (API-004).</summary>
public sealed class GetWebhookDeliveriesRequest
{
    public Guid WebhookUuid { get; set; }

    /// <summary>Domyślnie 20 — panel pod listą webhooków, nie pełna historia do przeglądania.</summary>
    public int Limit { get; set; } = 20;
}

public sealed class GetWebhookDeliveriesEndpoint
    : Endpoint<GetWebhookDeliveriesRequest, List<WebhookDeliveryDto>>
{
    private readonly IWebhookQueries _queries;

    public GetWebhookDeliveriesEndpoint(IWebhookQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getWebhookDeliveries");
        Group<WebhookGroup>();
        Permissions(P.TaskManagement.WebhookManage);
    }

    public override async Task HandleAsync(GetWebhookDeliveriesRequest req, CancellationToken ct)
    {
        var deliveries = await _queries.GetRecentDeliveriesAsync(req.WebhookUuid, Math.Clamp(req.Limit, 1, 100), ct);
        await Send.OkAsync(deliveries, ct);
    }
}
