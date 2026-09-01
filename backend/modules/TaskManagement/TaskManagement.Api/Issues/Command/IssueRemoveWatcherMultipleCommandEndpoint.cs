using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Rezygnacja z obserwowania zgłoszeń z obsługą błędów cząstkowych</summary>
public sealed class IssueRemoveWatcherMultipleCommandEndpoint
    : BatchEndpointBase<IssueRemoveWatcherCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueRemoveWatcherMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-watcher");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Rezygnacja z obserwowania zgłoszeń z obsługą błędów cząstkowych"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
