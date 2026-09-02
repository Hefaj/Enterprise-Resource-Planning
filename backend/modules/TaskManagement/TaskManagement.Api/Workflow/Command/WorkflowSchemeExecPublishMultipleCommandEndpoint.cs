using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Workflow;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Workflow.Command;

/// <summary>Publikuje usunięcie stanów z otwartymi zgłoszeniami razem z migracją tych zgłoszeń
/// przez zadanie masowe — widoczne postępem i sukcesem częściowym (WF-006)</summary>
public sealed class WorkflowSchemeExecPublishMultipleCommandEndpoint
    : BatchEndpointBase<WorkflowSchemeExecPublishCommand, SearchWorkflowSchemeRequest>
{
    private readonly IWorkflowSchemeQueries _queries;

    public WorkflowSchemeExecPublishMultipleCommandEndpoint(IWorkflowSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-exec-publish");
        Group<WorkflowGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary(
            "Publikuje usunięcie stanów z otwartymi zgłoszeniami razem z migracją tych zgłoszeń przez zadanie masowe"));
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
