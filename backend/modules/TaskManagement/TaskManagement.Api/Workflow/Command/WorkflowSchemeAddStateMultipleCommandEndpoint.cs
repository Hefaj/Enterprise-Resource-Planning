using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Command;

/// <summary>Dokłada stan do schematu — nowy stan pojawia się w kolumnach tablicy bez wdrożenia</summary>
public sealed class WorkflowSchemeAddStateMultipleCommandEndpoint
    : BatchEndpointBase<WorkflowSchemeAddStateCommand, SearchWorkflowSchemeRequest>
{
    private readonly IWorkflowSchemeQueries _queries;

    public WorkflowSchemeAddStateMultipleCommandEndpoint(IWorkflowSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-add-state");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Dokłada stan do schematu — nowy stan pojawia się w kolumnach tablicy bez wdrożenia"));
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
