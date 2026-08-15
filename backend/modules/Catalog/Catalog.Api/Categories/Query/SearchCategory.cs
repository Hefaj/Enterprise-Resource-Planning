using Catalog.Application.Categories;
using Erp.BuildingBlocks.Api.Contracts;
using FastEndpoints;

namespace Catalog.Categories.Query;

/// <summary>Wyszukiwanie kategorii w widoku płaskim.</summary>
public sealed class SearchCategoryEndpoint : Endpoint<SearchCategoryRequest, SearchResponse>
{
    private readonly ICategoryQueries _queries;

    public SearchCategoryEndpoint(ICategoryQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("searchCategory");
        Group<CategoryGroup>();
    }

    public override async Task HandleAsync(SearchCategoryRequest req, CancellationToken ct)
    {
        var response = await _queries.SearchAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
