using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.FieldSchemes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.FieldSchemes.Command;

/// <summary>Dokłada definicję pola do schematu — slot jest niezmienny po utworzeniu</summary>
public sealed class FieldSchemeAddFieldMultipleCommandEndpoint
    : BatchEndpointBase<FieldSchemeAddFieldCommand, SearchFieldSchemeRequest>
{
    private readonly IFieldSchemeQueries _queries;

    public FieldSchemeAddFieldMultipleCommandEndpoint(IFieldSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-add-field");
        Group<FieldSchemeGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Dokłada definicję pola do schematu — slot jest niezmienny po utworzeniu"));
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
