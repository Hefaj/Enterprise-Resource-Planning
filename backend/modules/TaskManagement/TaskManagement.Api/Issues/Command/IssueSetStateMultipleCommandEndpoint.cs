using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Seryjna zmiana stanu zgłoszeń — przejście spoza schematu odpada jako błąd elementu</summary>
public sealed class IssueSetStateMultipleCommandEndpoint
    : BatchEndpointBase<IssueSetStateCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueSetStateMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-state");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Seryjna zmiana stanu zgłoszeń — przejście spoza schematu odpada jako błąd elementu"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
