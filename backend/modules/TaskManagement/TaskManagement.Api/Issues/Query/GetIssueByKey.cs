using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>
/// Pobranie zgłoszenia po kluczu czytelnym (<c>DEV-412</c>). Trasa karty zgłoszenia na froncie
/// idzie po kluczu, nie po UUID — link krąży w mailach i commitach, a UUID nikt nie przepisze.
///
/// <para>Klucze historyczne są obsługiwane w zapytaniu, więc link sprzed przeniesienia projektu
/// nadal otwiera właściwe zgłoszenie (<c>docs/modules/task-management/domain.md</c> §4).</para>
/// </summary>
public sealed class GetIssueByKeyEndpoint : Endpoint<GetIssueByKeyRequest, IssueDto>
{
    private readonly IIssueQueries _queries;

    public GetIssueByKeyEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getIssueByKey");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetIssueByKeyRequest req, CancellationToken ct)
    {
        var issue = await _queries.GetByKeyAsync(req.Key, ct);

        if (issue is null)
        {
            // Brak dostępu i brak zgłoszenia dają tę samą odpowiedź celowo — rozróżnienie
            // zdradzałoby istnienie zgłoszeń z projektów, których użytkownik nie widzi.
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(issue, ct);
    }
}
