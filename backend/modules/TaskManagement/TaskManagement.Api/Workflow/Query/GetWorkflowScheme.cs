using FastEndpoints;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Query;

public sealed class GetWorkflowSchemeEndpoint : Endpoint<GetWorkflowSchemeRequest, WorkflowSchemeDto>
{
    private readonly IWorkflowQueries _queries;
    public GetWorkflowSchemeEndpoint(IWorkflowQueries queries) => _queries = queries;
    public override void Configure() { Post("getWorkflowScheme"); Group<WorkflowGroup>(); Permissions(P.TaskManagement.SchemeManage); }
    public override async Task HandleAsync(GetWorkflowSchemeRequest req, CancellationToken ct)
    {
        var scheme = await _queries.GetWorkflowSchemeAsync(req.SchemeUuid, ct);
        if (scheme is null) { await Send.NotFoundAsync(ct); return; }
        await Send.OkAsync(scheme, ct);
    }
}
