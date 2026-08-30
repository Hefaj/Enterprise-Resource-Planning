using FastEndpoints;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Query;

public sealed class GetWorkflowSchemesEndpoint : EndpointWithoutRequest<IReadOnlyList<WorkflowSchemeListItemDto>>
{
    private readonly IWorkflowQueries _queries;
    public GetWorkflowSchemesEndpoint(IWorkflowQueries queries) => _queries = queries;
    public override void Configure() { Get("getWorkflowSchemes"); Group<WorkflowGroup>(); Permissions(P.TaskManagement.SchemeManage); }
    public override async Task HandleAsync(CancellationToken ct) => await Send.OkAsync(await _queries.GetWorkflowSchemesAsync(ct), ct);
}
