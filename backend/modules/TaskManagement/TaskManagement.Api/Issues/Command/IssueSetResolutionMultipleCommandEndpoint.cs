using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Ustawienie rozwiązania zgłoszeń z obsługą błędów cząstkowych (ISS-007).</summary>
public sealed class IssueSetResolutionMultipleCommandEndpoint
    : BatchEndpointBase<IssueSetResolutionCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueSetResolutionMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-resolution");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Ustawienie rozwiązania zgłoszeń z obsługą błędów cząstkowych"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
