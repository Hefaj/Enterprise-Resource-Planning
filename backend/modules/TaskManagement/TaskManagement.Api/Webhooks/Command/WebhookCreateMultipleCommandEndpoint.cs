using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Webhooks;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Webhooks.Command;

/// <summary>Zakłada webhook wychodzący (API-004).</summary>
public sealed class WebhookCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<WebhookCreateCommand, SearchWebhookRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<WebhookGroup>();
        Permissions(P.TaskManagement.WebhookManage);
        Description(d => d.WithSummary("Zakłada webhook wychodzący"));
    }
}
