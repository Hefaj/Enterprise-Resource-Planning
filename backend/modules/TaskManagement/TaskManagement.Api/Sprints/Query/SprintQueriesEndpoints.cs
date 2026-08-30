using FastEndpoints;
using TaskManagement.Application.Sprints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Sprints.Query;

public sealed class SearchSprintEndpoint : Endpoint<SearchSprintRequest, Erp.BuildingBlocks.Api.Contracts.SearchResponse>
{
    private readonly ISprintQueries _queries;
    public SearchSprintEndpoint(ISprintQueries queries) => _queries = queries;
    public override void Configure() { Post("searchSprint"); Group<SprintGroup>(); Permissions(P.TaskManagement.IssueRead); }
    public override async Task HandleAsync(SearchSprintRequest req, CancellationToken ct) => await Send.OkAsync(await _queries.SearchAsync(req, ct), ct);
}

public sealed class GetSprintEndpoint : Endpoint<GetSprintRequest, List<SprintDto>>
{
    private readonly ISprintQueries _queries;
    public GetSprintEndpoint(ISprintQueries queries) => _queries = queries;
    public override void Configure() { Post("getSprint"); Group<SprintGroup>(); Permissions(P.TaskManagement.IssueRead); }
    public override async Task HandleAsync(GetSprintRequest req, CancellationToken ct) => await Send.OkAsync(await _queries.GetAsync(req.Uuids, ct), ct);
}
