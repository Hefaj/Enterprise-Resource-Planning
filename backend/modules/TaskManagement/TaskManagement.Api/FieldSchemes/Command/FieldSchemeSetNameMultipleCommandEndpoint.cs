using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.FieldSchemes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.FieldSchemes.Command;

/// <summary>Seryjna zmiana nazw schematów pól</summary>
public sealed class FieldSchemeSetNameMultipleCommandEndpoint
    : BatchEndpointBase<FieldSchemeSetNameCommand, SearchFieldSchemeRequest>
{
    private readonly IFieldSchemeQueries _queries;

    public FieldSchemeSetNameMultipleCommandEndpoint(IFieldSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set-name");
        Group<FieldSchemeGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Seryjna zmiana nazw schematów pól"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchFieldSchemeRequest filter,
        CancellationToken ct)
    {
        var schemes = await _queries.SearchAsync(filter, ct);

        return schemes.Select(s => s.Uuid);
    }
}
