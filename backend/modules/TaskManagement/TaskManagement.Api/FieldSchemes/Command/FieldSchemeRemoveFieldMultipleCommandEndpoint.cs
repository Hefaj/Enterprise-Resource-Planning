using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.FieldSchemes;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.FieldSchemes.Command;

/// <summary>Usuwa definicję pola — odmawia, gdy zgłoszenia mają w nim wartości</summary>
public sealed class FieldSchemeRemoveFieldMultipleCommandEndpoint
    : BatchEndpointBase<FieldSchemeRemoveFieldCommand, SearchFieldSchemeRequest>
{
    private readonly IFieldSchemeQueries _queries;

    public FieldSchemeRemoveFieldMultipleCommandEndpoint(IFieldSchemeQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove-field");
        Group<FieldSchemeGroup>();
        Permissions(P.TaskManagement.SchemeManage);
        Description(d => d.WithSummary("Usuwa definicję pola — odmawia, gdy zgłoszenia mają w nim wartości"));
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
