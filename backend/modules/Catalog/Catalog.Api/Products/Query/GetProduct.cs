using Catalog.Application.Products;
using FastEndpoints;
using P = Erp.BuildingBlocks.Contracts.Permissions;

namespace Catalog.Products.Query;

/// <summary>Pobranie produktów po identyfikatorach — druga połowa kontraktu „szukaj → pobierz”.</summary>
public sealed class GetProductEndpoint : Endpoint<GetProductRequest, List<ProductDto>>
{
    private readonly IProductQueries _queries;

    public GetProductEndpoint(IProductQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getProduct");
        Group<ProductGroup>();
        Permissions(P.Catalog.ProductRead);
    }

    public override async Task HandleAsync(GetProductRequest req, CancellationToken ct)
    {
        var products = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(products, ct);
    }
}
