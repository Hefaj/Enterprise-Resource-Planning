using FastEndpoints;
using TaskManagement.Application.Webhooks;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Webhooks.Query;

/// <summary>Webhooki projektu (API-004).</summary>
public sealed class SearchWebhookEndpoint : Endpoint<SearchWebhookRequest, List<WebhookDto>>
{
    private readonly IWebhookQueries _queries;

    public SearchWebhookEndpoint(IWebhookQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchWebhook");
        Group<WebhookGroup>();
        Permissions(P.TaskManagement.WebhookManage);
    }

    public override async Task HandleAsync(SearchWebhookRequest req, CancellationToken ct)
    {
        var webhooks = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(webhooks, ct);
    }
}
