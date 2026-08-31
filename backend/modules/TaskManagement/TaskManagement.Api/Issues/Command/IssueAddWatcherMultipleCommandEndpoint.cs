using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Zaczyna obserwować zgłoszenia. Za <c>IssueRead</c>, nie <c>IssueUpdate</c> —
/// obserwacja jest zapisem o wołającym, nie zmianą treści zgłoszenia.</summary>
public sealed class IssueAddWatcherMultipleCommandEndpoint : BatchEndpointBase<IssueAddWatcherCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueAddWatcherMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-add-watcher");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchIssueRequest filter, CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
