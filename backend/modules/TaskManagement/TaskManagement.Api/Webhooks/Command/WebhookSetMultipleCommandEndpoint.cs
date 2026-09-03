using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Webhooks;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Webhooks.Command;

/// <summary>Nadpisuje treść webhooka (API-004).</summary>
public sealed class WebhookSetMultipleCommandEndpoint
    : BatchEndpointBase<WebhookSetCommand, SearchWebhookRequest>
{
    private readonly IWebhookQueries _queries;

    public WebhookSetMultipleCommandEndpoint(IWebhookQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set");
        Group<WebhookGroup>();
        Permissions(P.TaskManagement.WebhookManage);
        Description(d => d.WithSummary("Nadpisuje webhook wychodzący"));
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchWebhookRequest filter, CancellationToken ct)
    {
        var webhooks = await _queries.SearchAsync(filter, ct);
        return webhooks.Select(w => w.Uuid);
    }
}
