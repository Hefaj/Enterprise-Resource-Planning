using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Odpięcie linku zewnętrznego (API-005) — paczka jednoelementowa z karty.</summary>
public sealed class IssueRemoveExternalLinkMultipleCommandEndpoint
    : BatchEndpointBase<IssueRemoveExternalLinkCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueRemoveExternalLinkMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-external-link");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Odpięcie linku zewnętrznego od zgłoszenia"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
