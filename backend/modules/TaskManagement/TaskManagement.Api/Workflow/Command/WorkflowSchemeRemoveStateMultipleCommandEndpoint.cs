using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Command;

/// <summary>Usuwa stan bez otwartych zgłoszeń — odmawia, gdy jakiekolwiek zgłoszenie w nim siedzi (WF-006)</summary>
public sealed class WorkflowSchemeRemoveStateMultipleCommandEndpoint
    : BatchEndpointBase<WorkflowSchemeRemoveStateCommand, SearchWorkflowSchemeRequest>
{
    private readonly IWorkflowSchemeQueries _queries;

    public WorkflowSchemeRemoveStateMultipleCommandEndpoint(IWorkflowSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-state");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Usuwa stan bez otwartych zgłoszeń — odmawia, gdy jakiekolwiek zgłoszenie w nim siedzi"));
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
