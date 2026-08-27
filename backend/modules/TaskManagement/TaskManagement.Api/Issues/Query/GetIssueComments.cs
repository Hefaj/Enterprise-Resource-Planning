using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Query;

/// <summary>Wątek komentarzy zgłoszenia — komentarze główne i odpowiedzi w jednej płaskiej
/// liście, poziom rozstrzyga <c>parentUuid</c>.</summary>
public sealed class GetIssueCommentsEndpoint : Endpoint<GetIssueCommentsRequest, List<IssueCommentDto>>
{
    private readonly IIssueCommentQueries _queries;

    public GetIssueCommentsEndpoint(IIssueCommentQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getIssueComments");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(GetIssueCommentsRequest req, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(req);

        var comments = await _queries.GetByIssueAsync(req.IssueUuid, ct);
        await Send.OkAsync(comments, ct);
    }
}
