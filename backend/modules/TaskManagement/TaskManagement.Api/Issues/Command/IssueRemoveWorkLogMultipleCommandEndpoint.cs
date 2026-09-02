using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Usunięcie wpisu czasu — paczka jednoelementowa, wzorem
/// <see cref="IssueAddWorkLogMultipleCommandEndpoint"/>.</summary>
public sealed class IssueRemoveWorkLogMultipleCommandEndpoint
    : BatchEndpointBase<IssueRemoveWorkLogCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueRemoveWorkLogMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-work-log");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Usunięcie wpisu czasu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
