using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.IssueTypes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.IssueTypes.Command;

/// <summary>Dokłada typ zgłoszenia do schematu — nowy typ pojawia się w modalu tworzenia bez wdrożenia</summary>
public sealed class IssueTypeSchemeAddTypeMultipleCommandEndpoint
    : BatchEndpointBase<IssueTypeSchemeAddTypeCommand, SearchIssueTypeSchemeRequest>
{
    private readonly IIssueTypeSchemeQueries _queries;

    public IssueTypeSchemeAddTypeMultipleCommandEndpoint(IIssueTypeSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-add-type");
        Group<IssueTypeGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Dokłada typ zgłoszenia do schematu — nowy typ pojawia się w modalu tworzenia bez wdrożenia"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchIssueTypeSchemeRequest filter,
        CancellationToken ct)
    {
        var schemes = await _queries.SearchAsync(filter, ct);

        return schemes.Select(s => s.Uuid);
    }
}
