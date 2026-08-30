using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

public sealed class GetIssueWorkLogsEndpoint : Endpoint<GetIssueWorkLogsRequest, IReadOnlyList<WorkLogDto>>
{
    private readonly IWorkLogQueries _queries;
    public GetIssueWorkLogsEndpoint(IWorkLogQueries queries) => _queries = queries;
    public override void Configure() { Post("getIssueWorkLogs"); Group<IssueGroup>(); Permissions(P.TaskManagement.IssueRead); }
    public override async Task HandleAsync(GetIssueWorkLogsRequest req, CancellationToken ct)
        => await Send.OkAsync(await _queries.GetForIssueAsync(req.IssueUuid, ct), ct);
}

public sealed class GetSavedIssueViewsEndpoint : EndpointWithoutRequest<IReadOnlyList<SavedIssueViewDto>>
{
    private readonly IWorkLogQueries _queries;
    public GetSavedIssueViewsEndpoint(IWorkLogQueries queries) => _queries = queries;
    public override void Configure() { Get("getSavedIssueViews"); Group<IssueGroup>(); Permissions(P.TaskManagement.IssueRead); }
    public override async Task HandleAsync(CancellationToken ct)
        => await Send.OkAsync(await _queries.GetSavedViewsAsync(ct), ct);
}
