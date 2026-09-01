using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Projects;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Projects.Command;

/// <summary>Seryjne ustawienie polityki SLA projektów z obsługą błędów cząstkowych</summary>
public sealed class ProjectSetSlaMultipleCommandEndpoint
    : BatchEndpointBase<ProjectSetSlaCommand, SearchProjectRequest>
{
    private readonly IProjectQueries _queries;

    public ProjectSetSlaMultipleCommandEndpoint(IProjectQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-sla");
        Group<ProjectGroup>();
        Permissions(P.TaskManagement.ProjectManage);
        Description(d => d.WithSummary("Seryjne ustawienie polityki SLA projektów z obsługą błędów cząstkowych"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProjectRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
