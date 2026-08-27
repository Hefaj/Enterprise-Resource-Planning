using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>Podpina albo odpina schemat pól projektu</summary>
public sealed class ProjectSetFieldSchemeMultipleCommandEndpoint
    : BatchEndpointBase<ProjectSetFieldSchemeCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectSetFieldSchemeMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-field-scheme");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.ProjectManage);
        Description(d => d.WithSummary("Podpina albo odpina schemat pól projektu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProjectRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
