using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Nadpisuje wartości pól niestandardowych zgłoszeń — pole pominięte zostaje wyczyszczone</summary>
public sealed class IssueSetCustomFieldsMultipleCommandEndpoint
    : BatchEndpointBase<IssueSetCustomFieldsCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueSetCustomFieldsMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-custom-fields");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Nadpisuje wartości pól niestandardowych zgłoszeń — pole pominięte zostaje wyczyszczone"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
