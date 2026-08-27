using FastEndpoints;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Query;

/// <summary>Pobranie projektów po identyfikatorach.</summary>
public sealed class GetProjectEndpoint : Endpoint<GetProjectRequest, List<ProjectDto>>
{
    private readonly IProjectQueries _queries;

    public GetProjectEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getProject");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetProjectRequest req, CancellationToken ct)
    {
        var projects = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(projects, ct);
    }
}
