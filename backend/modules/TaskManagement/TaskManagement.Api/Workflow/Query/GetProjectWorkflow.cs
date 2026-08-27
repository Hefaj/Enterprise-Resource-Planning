using FastEndpoints;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Query;

/// <summary>
/// Schemat stanów projektu — stany i przejścia jednym żądaniem. To jedyne źródło, z którego front
/// zna stany: filtr na liście, przyciski przejść na karcie i (od fazy 2) kolumny tablicy
/// budują się z tej odpowiedzi, nigdy ze stałej w komponencie.
/// </summary>
public sealed class GetProjectWorkflowEndpoint : Endpoint<GetProjectWorkflowRequest, ProjectWorkflowDto>
{
    private readonly IWorkflowQueries _queries;

    public GetProjectWorkflowEndpoint(IWorkflowQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getProjectWorkflow");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetProjectWorkflowRequest req, CancellationToken ct)
    {
        var workflow = await _queries.GetProjectWorkflowAsync(req.ProjectUuid, ct);

        if (workflow is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(workflow, ct);
    }
}
