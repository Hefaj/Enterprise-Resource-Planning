using FastEndpoints;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Query;

/// <summary>Pojedynczy schemat stanów — zakładka „Schemat stanów" na karcie projektu (WF-007).</summary>
public sealed class GetWorkflowSchemeEndpoint : Endpoint<GetWorkflowSchemeRequest, WorkflowSchemeDto?>
{
    private readonly IWorkflowSchemeQueries _queries;

    public GetWorkflowSchemeEndpoint(IWorkflowSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getWorkflowScheme");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetWorkflowSchemeRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var scheme = await _queries.GetAsync(req.Uuid, ct);
        await Send.OkAsync(scheme, ct);
    }
}
