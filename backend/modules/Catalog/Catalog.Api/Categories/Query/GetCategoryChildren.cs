using Catalog.Application.Categories;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Categories.Query;

/// <summary>
/// Leniwe doładowywanie dzieci węzła w <c>erp-tree</c> (tryb server).
///
/// Odpowiada za scenariusz „load more” przy węzłach o setkach dzieci — dlatego stronicowanie
/// jest tu po <c>PageIndex</c>/<c>PageSize</c>, a nie po numerze strony jak w pozostałych
/// wyszukiwaniach: drzewo dociąga kolejne porcje tego samego poziomu, nie przeskakuje między stronami.
/// </summary>
public sealed class GetCategoryChildrenEndpoint
    : Endpoint<GetCategoryChildrenRequest, GetCategoryChildrenResponse>
{
    private readonly ICategoryQueries _queries;

    public GetCategoryChildrenEndpoint(ICategoryQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getCategoryChildren");
        Group<CategoryGroup>();
        Permissions(P.Catalog.CategoryRead);
    }

    public override async Task HandleAsync(GetCategoryChildrenRequest req, CancellationToken ct)
    {
        var response = await _queries.GetChildrenAsync(req, ct);
        await Send.OkAsync(response, ct);
    }
}
