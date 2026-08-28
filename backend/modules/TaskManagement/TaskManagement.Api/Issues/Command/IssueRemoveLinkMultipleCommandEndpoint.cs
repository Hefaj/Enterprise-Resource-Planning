using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Seryjne odpięcie powiązań — bez pre-checku, bo usunięcie krawędzi nie może
/// zamknąć pętli</summary>
public sealed class IssueRemoveLinkMultipleCommandEndpoint
    : BatchEndpointBase<IssueRemoveLinkCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueRemoveLinkMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-link");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Seryjne odpięcie powiązań — bez pre-checku, bo usunięcie krawędzi nie może zamknąć pętli"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
