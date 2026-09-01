using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Dopisanie zgłaszającego do obserwatorów zgłoszeń z obsługą błędów cząstkowych</summary>
public sealed class IssueAddWatcherMultipleCommandEndpoint
    : BatchEndpointBase<IssueAddWatcherCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueAddWatcherMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-add-watcher");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Dopisanie zgłaszającego do obserwatorów zgłoszeń z obsługą błędów cząstkowych"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
