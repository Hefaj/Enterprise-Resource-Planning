using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>Seryjne odebranie roli w projekcie</summary>
public sealed class ProjectRemoveMemberMultipleCommandEndpoint
    : BatchEndpointBase<ProjectRemoveMemberCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectRemoveMemberMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-member");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.ProjectManage);
        Description(d => d.WithSummary("Seryjne odebranie roli w projekcie"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProjectRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
