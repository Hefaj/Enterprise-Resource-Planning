using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Command;

/// <summary>Zakłada schematy stanów</summary>
public sealed class WorkflowSchemeCreateMultipleCommandEndpoint
    : CreateBatchEndpointBase<WorkflowSchemeCreateCommand, SearchWorkflowSchemeRequest>
{
    public override void Configure()
    {
        Post("batch-create");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Zakłada schematy stanów"));
    }
}
