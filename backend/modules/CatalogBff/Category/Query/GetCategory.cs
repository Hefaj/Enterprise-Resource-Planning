using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CatalogBff.Category.Query;

public class GetCategoryRequest
{
    public List<Guid>? Uuids { get; set; }
}

public class GetCategoryEndpoint : Endpoint<GetCategoryRequest, List<CategoryDto>>
{
    public override void Configure()
    {
        Post("get");
        Group<CategoryGroup>();
    }

    public override async Task HandleAsync(GetCategoryRequest req, CancellationToken ct)
    {
        var result = CatalogMockData.Categories;

        if (req.Uuids != null && req.Uuids.Any())
        {
            result = result.Where(c => req.Uuids.Contains(c.Uuid)).ToList();
        }

        await Send.OkAsync(result, ct);
    }
}
