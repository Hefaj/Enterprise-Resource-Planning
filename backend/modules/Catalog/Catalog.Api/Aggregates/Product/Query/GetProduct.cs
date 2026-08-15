using Catalog.Application.Contracts;
using FastEndpoints;

namespace Catalog.Product.Query;

/// <summary>Pobranie produktów po identyfikatorach — druga połowa kontraktu „szukaj → pobierz”.</summary>
public sealed class GetProductEndpoint : Endpoint<GetProductRequest, List<ProductDto>>
{
    private readonly IProductQueries _queries;

    public GetProductEndpoint(IProductQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getProduct");
        Group<ProductGroup>();
    }

    public override async Task HandleAsync(GetProductRequest req, CancellationToken ct)
    {
        var products = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(products, ct);
    }
}
