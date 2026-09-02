using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>Archiwizacja/przywrócenie projektu (PRJ-004).</summary>
public sealed class ProjectSetArchivedMultipleCommandEndpoint
    : BatchEndpointBase<ProjectSetArchivedCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectSetArchivedMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-archived");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.ProjectManage);
        Description(d => d.WithSummary("Archiwizacja/przywrócenie projektu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProjectRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
