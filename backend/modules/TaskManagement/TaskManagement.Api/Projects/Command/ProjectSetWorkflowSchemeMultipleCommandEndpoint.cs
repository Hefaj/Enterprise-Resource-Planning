using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>
/// Zmiana automatu stanów projektu. Za <c>SchemeManage</c>, nie <c>ProjectManage</c> — decyzja
/// dotyczy konfiguracji obiegu, a jej skutkiem jest migracja stanów wszystkich zgłoszeń projektu.
/// </summary>
public sealed class ProjectSetWorkflowSchemeMultipleCommandEndpoint
    : BatchEndpointBase<ProjectSetWorkflowSchemeCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectSetWorkflowSchemeMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-workflow-scheme");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.SchemeManage);
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchProjectRequest filter, CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
