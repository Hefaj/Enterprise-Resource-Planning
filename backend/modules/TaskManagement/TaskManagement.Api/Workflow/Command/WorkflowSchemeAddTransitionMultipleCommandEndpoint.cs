using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Command;

/// <summary>Dokłada przejście do schematu</summary>
public sealed class WorkflowSchemeAddTransitionMultipleCommandEndpoint
    : BatchEndpointBase<WorkflowSchemeAddTransitionCommand, SearchWorkflowSchemeRequest>
{
    private readonly IWorkflowSchemeQueries _queries;

    public WorkflowSchemeAddTransitionMultipleCommandEndpoint(IWorkflowSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-add-transition");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Dokłada przejście do schematu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchWorkflowSchemeRequest filter,
        CancellationToken ct)
    {
        var schemes = await _queries.SearchAsync(filter, ct);

        return schemes.Select(s => s.Uuid);
    }
}
