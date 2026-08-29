using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

public sealed class ProjectSetSlaPolicyMultipleCommandEndpoint
    : BatchEndpointBase<ProjectSetSlaPolicyCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectSetSlaPolicyMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-sla-policy");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.ProjectManage);
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchProjectRequest filter, CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
