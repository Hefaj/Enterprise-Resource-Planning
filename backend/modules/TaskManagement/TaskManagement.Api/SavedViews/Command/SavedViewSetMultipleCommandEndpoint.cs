using Erp.BuildingBlocks.Api.Contracts;
using TaskManagement.Application.SavedViews;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.SavedViews.Command;

/// <summary>Nadpisuje treść zapisanego widoku (VIEW-001). Tylko właściciel — handler odrzuca
/// cudzy udostępniony widok (<c>SavedViewOwnership.EnsureOwner</c>).</summary>
public sealed class SavedViewSetMultipleCommandEndpoint
    : BatchEndpointBase<SavedViewSetCommand, SearchSavedViewRequest>
{
    private readonly ISavedViewQueries _queries;

    public SavedViewSetMultipleCommandEndpoint(ISavedViewQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("batch-set");
        Group<SavedViewGroup>();
        Permissions(P.TaskManagement.IssueRead);
        Description(d => d.WithSummary("Nadpisuje zapisany widok"));
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
