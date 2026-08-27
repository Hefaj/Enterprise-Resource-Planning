using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>Pobranie zgłoszeń po identyfikatorach — źródło wierszy dla orkiestratora.</summary>
public sealed class GetIssueEndpoint : Endpoint<GetIssueRequest, List<IssueDto>>
{
    private readonly IIssueQueries _queries;

    public GetIssueEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getIssue");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetIssueRequest req, CancellationToken ct)
    {
        var issues = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(issues, ct);
    }
}
