using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Przestaje obserwować zgłoszenia.</summary>
public sealed class IssueRemoveWatcherMultipleCommandEndpoint : BatchEndpointBase<IssueRemoveWatcherCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueRemoveWatcherMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-watcher");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(SearchIssueRequest filter, CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
