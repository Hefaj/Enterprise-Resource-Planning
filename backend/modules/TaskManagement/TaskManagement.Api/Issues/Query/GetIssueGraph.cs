using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>
/// Hierarchia i powiązania zgłoszenia w jednej odpowiedzi — pasek powiązań na karcie rysuje się
/// z niej w całości, bez trzech osobnych żądań.
/// </summary>
public sealed class GetIssueGraphEndpoint : Endpoint<GetIssueGraphRequest, IssueGraphDto>
{
    private readonly IIssueGraphQueries _queries;

    public GetIssueGraphEndpoint(IIssueGraphQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getIssueGraph");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetIssueGraphRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var graph = await _queries.GetGraphAsync(req.IssueUuid, ct);
        await Send.OkAsync(graph, ct);
    }
}
