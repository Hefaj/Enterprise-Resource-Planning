using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Webhooks;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Webhooks.Command;

/// <summary>Usuwa webhook wychodzący.</summary>
public sealed class WebhookRemoveMultipleCommandEndpoint
    : BatchEndpointBase<WebhookRemoveCommand, SearchWebhookRequest>
{
    private readonly IWebhookQueries _queries;

    public WebhookRemoveMultipleCommandEndpoint(IWebhookQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove");
        Group<WebhookGroup>();
        Permissions(P.TaskManagement.WebhookManage);
        Description(d => d.WithSummary("Usuwa webhook wychodzący"));
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchWebhookRequest filter, CancellationToken ct)
    {
        var webhooks = await _queries.SearchAsync(filter, ct);
        return webhooks.Select(w => w.Uuid);
    }
}
