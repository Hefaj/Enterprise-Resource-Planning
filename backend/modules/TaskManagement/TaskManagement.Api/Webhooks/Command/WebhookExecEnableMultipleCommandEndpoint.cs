using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Webhooks;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Webhooks.Command;

/// <summary>Włącza webhook i resetuje licznik błędów (API-004).</summary>
public sealed class WebhookExecEnableMultipleCommandEndpoint
    : BatchEndpointBase<WebhookExecEnableCommand, SearchWebhookRequest>
{
    private readonly IWebhookQueries _queries;

    public WebhookExecEnableMultipleCommandEndpoint(IWebhookQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-exec-enable");
        Group<WebhookGroup>();
        Permissions(P.TaskManagement.WebhookManage);
        Description(d => d.WithSummary("Włącza webhook wychodzący"));
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchWebhookRequest filter, CancellationToken ct)
    {
        var webhooks = await _queries.SearchAsync(filter, ct);
        return webhooks.Where(w => !w.IsEnabled).Select(w => w.Uuid);
    }
}
