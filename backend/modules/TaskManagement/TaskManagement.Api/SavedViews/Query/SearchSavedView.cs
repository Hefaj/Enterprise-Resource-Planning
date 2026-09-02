using FastEndpoints;
using TaskManagement.Application.SavedViews;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace TaskManagement.SavedViews.Query;

/// <summary>Zapisane widoki wołającego plus, gdy podano projekt, widoki udostępnione temu
/// projektowi (VIEW-001).</summary>
public sealed class SearchSavedViewEndpoint : Endpoint<SearchSavedViewRequest, List<SavedViewDto>>
{
    private readonly ISavedViewQueries _queries;

    public SearchSavedViewEndpoint(ISavedViewQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchSavedView");
        Group<SavedViewGroup>();
        Permissions(P.TaskManagement.IssueRead);
    }

    public override async Task HandleAsync(SearchSavedViewRequest req, CancellationToken ct)
    {
        var views = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(views, ct);
    }
}
