using Catalog.Application.Categories;
using FastEndpoints;

namespace Catalog.Categories.Query;

/// <summary>Pobranie kategorii po identyfikatorach.</summary>
public sealed class GetCategoryEndpoint : Endpoint<GetCategoryRequest, List<CategoryDto>>
{
    private readonly ICategoryQueries _queries;

    public GetCategoryEndpoint(ICategoryQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getCategory");
        Group<CategoryGroup>();
    }

    public override async Task HandleAsync(GetCategoryRequest req, CancellationToken ct)
    {
        var items = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(items, ct);
    }
}
