using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.IssueTypes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.IssueTypes.Command;

/// <summary>Seryjna zmiana szczegółów typu — nazwa, ikona, kolejność, nadpisania schematów</summary>
public sealed class IssueTypeSchemeSetTypeMultipleCommandEndpoint
    : BatchEndpointBase<IssueTypeSchemeSetTypeCommand, SearchIssueTypeSchemeRequest>
{
    private readonly IIssueTypeSchemeQueries _queries;

    public IssueTypeSchemeSetTypeMultipleCommandEndpoint(IIssueTypeSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-type");
        Group<IssueTypeGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Seryjna zmiana szczegółów typu — nazwa, ikona, kolejność, nadpisania schematów"));
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
