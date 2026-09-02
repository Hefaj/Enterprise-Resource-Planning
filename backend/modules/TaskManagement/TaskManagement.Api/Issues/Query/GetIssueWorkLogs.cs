using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>Wpisy czasu zgłoszenia (TIME-001/002) — dane strukturalne dla sekcji czasu
/// na karcie, osobno od tekstu w strumieniu aktywności.</summary>
public sealed class GetIssueWorkLogsEndpoint : Endpoint<GetIssueWorkLogsRequest, List<IssueWorkLogDto>>
{
    private readonly IIssueWorkLogQueries _queries;

    public GetIssueWorkLogsEndpoint(IIssueWorkLogQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getIssueWorkLogs");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetIssueWorkLogsRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var workLogs = await _queries.GetByIssueAsync(req.IssueUuid, ct);
        await Send.OkAsync(workLogs, ct);
    }
}
