using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>
/// Przenosi zgłoszenia do innego projektu. Za <c>IssueBulk</c>, nie <c>IssueUpdate</c>:
/// operacja zmienia klucz czytelny i granicę widoczności, więc nie jest zwykłą edycją pola.
/// </summary>
public sealed class IssueSetProjectMultipleCommandEndpoint : BatchEndpointBase<IssueSetProjectCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueSetProjectMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-project");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueBulk);
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchIssueRequest filter, CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
