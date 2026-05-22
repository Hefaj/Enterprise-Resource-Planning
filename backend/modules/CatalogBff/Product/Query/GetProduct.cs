using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CatalogBff.Product.Query;

public class GetProductRequest
{
    public List<Guid>? Uuids { get; set; }
}

public class GetProductEndpoint : Endpoint<GetProductRequest, List<ProductDto>>
{
    public override void Configure()
    {
        Post("get");
        Group<ProductGroup>();
    }

    public override async Task HandleAsync(GetProductRequest req, CancellationToken ct)
    {
        var result = CatalogMockData.Products;

        if (req.Uuids != null && req.Uuids.Any())
        {
            result = result.Where(p => req.Uuids.Contains(p.Uuid)).ToList();
        }

        await Send.OkAsync(result, ct);
    }
}
