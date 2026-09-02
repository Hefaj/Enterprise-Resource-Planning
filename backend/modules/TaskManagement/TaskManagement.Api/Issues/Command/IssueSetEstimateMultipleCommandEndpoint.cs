using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Ustawia estymatę zgłoszenia (TIME-002) — paczka jednoelementowa, wzorem
/// <see cref="IssueAddWorkLogMultipleCommandEndpoint"/>.</summary>
public sealed class IssueSetEstimateMultipleCommandEndpoint
    : BatchEndpointBase<IssueSetEstimateCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueSetEstimateMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-estimate");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Ustawia estymatę zgłoszenia"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
