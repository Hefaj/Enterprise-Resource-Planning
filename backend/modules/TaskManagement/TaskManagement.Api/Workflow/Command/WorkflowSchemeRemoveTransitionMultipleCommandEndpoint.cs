using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Command;

/// <summary>Usuwa przejście ze schematu</summary>
public sealed class WorkflowSchemeRemoveTransitionMultipleCommandEndpoint
    : BatchEndpointBase<WorkflowSchemeRemoveTransitionCommand, SearchWorkflowSchemeRequest>
{
    private readonly IWorkflowSchemeQueries _queries;

    public WorkflowSchemeRemoveTransitionMultipleCommandEndpoint(IWorkflowSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-transition");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Usuwa przejście ze schematu"));
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
