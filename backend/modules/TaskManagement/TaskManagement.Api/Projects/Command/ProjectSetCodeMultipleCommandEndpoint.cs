using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>Zmiana prefiksu klucza projektu (PRJ-003) — istniejące zgłoszenia zachowują swój
/// klucz.</summary>
public sealed class ProjectSetCodeMultipleCommandEndpoint
    : BatchEndpointBase<ProjectSetCodeCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectSetCodeMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-code");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.ProjectManage);
        Description(d => d.WithSummary("Zmiana prefiksu klucza projektu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProjectRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
