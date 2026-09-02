using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.SavedViews;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.SavedViews.Command;

/// <summary>Usuwa zapisany widok (VIEW-001). Tylko właściciel.</summary>
public sealed class SavedViewRemoveMultipleCommandEndpoint
    : BatchEndpointBase<SavedViewRemoveCommand, SearchSavedViewRequest>
{
    private readonly ISavedViewQueries _queries;

    public SavedViewRemoveMultipleCommandEndpoint(ISavedViewQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-remove");
        Group<SavedViewGroup>();
        Permissions(P.TaskManagement.IssueRead);
        Description(d => d.WithSummary("Usuwa zapisany widok"));
    }

    /// <inheritdoc />
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchSavedViewRequest filter,
        CancellationToken ct)
    {
        var views = await _queries.SearchAsync(filter, ct);

        return views.Where(v => v.IsOwn).Select(v => v.Uuid);
    }
}
