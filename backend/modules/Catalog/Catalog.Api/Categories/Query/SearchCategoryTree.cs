using Catalog.Application.Categories;
using FastEndpoints;

namespace Catalog.Categories.Query;

/// <summary>
/// Wyszukiwanie kategorii po nazwie wraz z kontekstem hierarchii.
///
/// Obok trafień zwraca ich przodków, żeby <c>erp-tree-picker</c> mógł pokazać wynik w drzewie
/// bez dopytywania o ścieżkę każdego trafienia z osobna.
/// </summary>
public sealed class SearchCategoryTreeEndpoint
    : Endpoint<SearchCategoryTreeRequest, SearchCategoryTreeResponse>
{
    private readonly ICategoryQueries _queries;

    public SearchCategoryTreeEndpoint(ICategoryQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchCategoryTree");
        Group<CategoryGroup>();
    }

    public override async Task HandleAsync(SearchCategoryTreeRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchTreeAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
