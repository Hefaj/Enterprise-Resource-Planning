using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>Ustawia widok domyślny projektu (VIEW-002).</summary>
public sealed class ProjectSetDefaultSavedViewMultipleCommandEndpoint
    : BatchEndpointBase<ProjectSetDefaultSavedViewCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectSetDefaultSavedViewMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-default-saved-view");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.ProjectManage);
        Description(d => d.WithSummary("Ustawia widok domyślny projektu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProjectRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
