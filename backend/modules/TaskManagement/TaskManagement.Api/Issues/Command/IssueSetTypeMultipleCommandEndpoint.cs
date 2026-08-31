using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Seryjna zmiana typu zgłoszeń — migruje stan, gdy nowy typ nadpisuje inny automat</summary>
public sealed class IssueSetTypeMultipleCommandEndpoint
    : BatchEndpointBase<IssueSetTypeCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueSetTypeMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-type");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Seryjna zmiana typu zgłoszeń — migruje stan, gdy nowy typ nadpisuje inny automat"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
