using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.Issues;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.Issues.Command;

/// <summary>Usunięcie pojedynczego załącznika (ATT-002) — paczka jednoelementowa z karty,
/// wzorem <c>IssueRemoveWorkLogMultipleCommandEndpoint</c>.</summary>
public sealed class IssueRemoveAttachmentMultipleCommandEndpoint
    : BatchEndpointBase<IssueRemoveAttachmentCommand, SearchIssueRequest>
{
    private readonly IIssueQueries _queries;

    public IssueRemoveAttachmentMultipleCommandEndpoint(IIssueQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-attachment");
        Group<IssueGroup>();
        Permissions(P.TaskManagement.IssueUpdate);
        Description(d => d.WithSummary("Usunięcie pojedynczego załącznika"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueRequest filter,
        CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
