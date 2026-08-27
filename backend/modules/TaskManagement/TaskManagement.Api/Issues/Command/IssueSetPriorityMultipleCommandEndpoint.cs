using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Seryjna zmiana priorytetu zgłoszeń z obsługą błędów cząstkowych</summary>
public sealed class IssueSetPriorityMultipleCommandEndpoint
    : BatchEndpointBase<IssueSetPriorityCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueSetPriorityMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-priority");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Seryjna zmiana priorytetu zgłoszeń z obsługą błędów cząstkowych"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
