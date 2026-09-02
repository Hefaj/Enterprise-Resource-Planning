using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Command;

/// <summary>Seryjna zmiana szczegółów stanu — nazwa, kategoria, kolejność</summary>
public sealed class WorkflowSchemeSetStateMultipleCommandEndpoint
    : BatchEndpointBase<WorkflowSchemeSetStateCommand, SearchWorkflowSchemeRequest>
{
    private readonly IWorkflowSchemeQueries _queries;

    public WorkflowSchemeSetStateMultipleCommandEndpoint(IWorkflowSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-state");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Seryjna zmiana szczegółów stanu — nazwa, kategoria, kolejność"));
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
