using FastEndpoints;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Query;

/// <summary>Schematy stanów razem ze stanami i przejściami — ekran konfiguracji projektu (WF-007).</summary>
public sealed class SearchWorkflowSchemeEndpoint : Endpoint<SearchWorkflowSchemeRequest, List<WorkflowSchemeDto>>
{
    private readonly IWorkflowSchemeQueries _queries;

    public SearchWorkflowSchemeEndpoint(IWorkflowSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchWorkflowScheme");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchWorkflowSchemeRequest req, CancellationToken ct)
    {
        var schemes = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(schemes, ct);
    }
}
