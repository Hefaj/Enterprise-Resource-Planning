using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>Seryjne nadanie roli w projekcie — atrybut nadania, nie kod uprawnienia</summary>
public sealed class ProjectAddMemberMultipleCommandEndpoint
    : BatchEndpointBase<ProjectAddMemberCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectAddMemberMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-add-member");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.ProjectManage);
        Description(d => d.WithSummary("Seryjne nadanie roli w projekcie — atrybut nadania, nie kod uprawnienia"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProjectRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
