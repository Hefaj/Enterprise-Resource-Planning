using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Webhooks;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Webhooks.Command;

/// <summary>Wyłącza webhook bez usuwania (API-004).</summary>
public sealed class WebhookExecDisableMultipleCommandEndpoint
    : BatchEndpointBase<WebhookExecDisableCommand, SearchWebhookRequest>
{
    private readonly IWebhookQueries _queries;

    public WebhookExecDisableMultipleCommandEndpoint(IWebhookQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-exec-disable");
        Group<WebhookGroup>();
        Permissions(P.TaskManagement.WebhookManage);
        Description(d => d.WithSummary("Wyłącza webhook wychodzący"));
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchWebhookRequest filter, CancellationToken ct)
    {
        var webhooks = await _queries.SearchAsync(filter, ct);
        return webhooks.Where(w => w.IsEnabled).Select(w => w.Uuid);
    }
}
