using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>
/// Historia zmian zgłoszenia — najnowsze pierwsze.
///
/// <para>Osobne zapytanie, a nie pole w <c>IssueDto</c>: historia rośnie w nieskończoność
/// i nie ma jej po co wozić z każdym wierszem listy zgłoszeń. Kartę interesuje wtedy, gdy
/// użytkownik otworzy zakładkę.</para>
/// </summary>
public sealed class GetIssueActivityEndpoint : Endpoint<GetIssueActivityRequest, List<IssueActivityDto>>
{
    private readonly IIssueActivityQueries _queries;

    public GetIssueActivityEndpoint(IIssueActivityQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getIssueActivity");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetIssueActivityRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var entries = await _queries.GetByIssueAsync(req.IssueUuid, ct);
        await Send.OkAsync(entries, ct);
    }
}
