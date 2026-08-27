using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Zmiana treści komentarzy z obsługą błędów cząstkowych</summary>
///
/// <remarks>
/// Wsad ma tu jednego realnego użytkownika: paczkę jednoelementową z karty zgłoszenia.
/// Endpoint stoi na wspólnym szkielecie, bo dzięki temu komentarz dziedziczy idempotencję
/// (<c>X-Request-Id</c>), ślad w historii zadań i tę samą obsługę błędów, co reszta zapisów —
/// nie dlatego, że ktokolwiek komentuje masowo
/// (patrz <see cref="IssueSetCommentBodyCommand"/>).
/// </remarks>
public sealed class IssueSetCommentBodyMultipleCommandEndpoint
    : BatchEndpointBase<IssueSetCommentBodyCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueSetCommentBodyMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-comment-body");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Zmiana treści komentarzy z obsługą błędów cząstkowych"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
