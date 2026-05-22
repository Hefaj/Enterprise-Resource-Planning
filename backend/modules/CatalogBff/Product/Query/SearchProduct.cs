using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CatalogBff.Product.Query;

public class SearchProductRequest
{
    public string? Sku { get; set; }
    public string? Name { get; set; }
    public string? Category { get; set; }
    public decimal? Price { get; set; }
    public DateTime? AvailableFrom { get; set; }
}

public class SearchProductEndpoint : Endpoint<SearchProductRequest, List<Guid>>
{
    public override void Configure()
    {
        Post("search");
        Group<ProductGroup>();
    }

    public override async Task HandleAsync(SearchProductRequest req, CancellationToken ct)
    {
        var query = CatalogMockData.Products.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(req.Sku))
        {
            query = query.Where(p => p.Sku.Contains(req.Sku, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            query = query.Where(p => p.Name.Contains(req.Name, StringComparison.OrdinalIgnoreCase));
        }

        if (req.Price.HasValue)
        {
            query = query.Where(p => p.Price <= req.Price.Value);
        }

        if (req.AvailableFrom.HasValue)
        {
            query = query.Where(p => p.AvailableFrom >= req.AvailableFrom.Value);
        }

        var uuids = query.Select(p => p.Uuid).ToList();
        await Send.OkAsync(uuids, ct);
    }
}
