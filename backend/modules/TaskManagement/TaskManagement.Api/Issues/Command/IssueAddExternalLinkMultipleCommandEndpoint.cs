using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Dopięcie linku zewnętrznego (API-005) — paczka jednoelementowa z karty.</summary>
public sealed class IssueAddExternalLinkMultipleCommandEndpoint
    : BatchEndpointBase<IssueAddExternalLinkCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueAddExternalLinkMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-add-external-link");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Dopięcie linku zewnętrznego do zgłoszenia"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
