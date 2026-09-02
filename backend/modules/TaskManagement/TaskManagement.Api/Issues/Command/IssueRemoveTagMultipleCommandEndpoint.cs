using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Odpięcie tagu od zgłoszeń z obsługą błędów cząstkowych (TAG-001).</summary>
public sealed class IssueRemoveTagMultipleCommandEndpoint
    : BatchEndpointBase<IssueRemoveTagCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueRemoveTagMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-tag");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Odpięcie tagu od zgłoszeń z obsługą błędów cząstkowych"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
