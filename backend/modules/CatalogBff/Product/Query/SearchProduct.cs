using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;
using CatalogBff.Common;

namespace CatalogBff.Product.Query;

public class SearchProductRequest : PagedRequest
{
    public string? Sku { get; set; }
    public string? Name { get; set; }
    public string? Category { get; set; }
    public decimal? Price { get; set; }
    public DateTime? AvailableFrom { get; set; }
}

public class SearchProductEndpoint : Endpoint<SearchProductRequest, SearchResponse>
{
    public override void Configure()
    {
        Post("searchProduct");
        Group<ProductGroup>();
    }

    public override async Task HandleAsync(SearchProductRequest req, CancellationToken ct)
    {
        var query = CatalogMockData.Products.AsEnumerable().ApplyFilter(req);

        if (req.Sorts != null && req.Sorts.Any())
        {
            var firstSort = req.Sorts.First();
            var isDesc = firstSort.Order == -1;
            var orderedQuery = firstSort.Field.ToLower() switch
            {
                "sku" => isDesc ? query.OrderByDescending(p => p.Sku) : query.OrderBy(p => p.Sku),
                "name" => isDesc ? query.OrderByDescending(p => p.Name) : query.OrderBy(p => p.Name),
                "price" => isDesc ? query.OrderByDescending(p => p.Price) : query.OrderBy(p => p.Price),
                "availablefrom" => isDesc ? query.OrderByDescending(p => p.AvailableFrom) : query.OrderBy(p => p.AvailableFrom),
                "status" => isDesc ? query.OrderByDescending(p => p.Status) : query.OrderBy(p => p.Status),
                "available" => isDesc ? query.OrderByDescending(p => p.Available) : query.OrderBy(p => p.Available),
                _ => query.OrderBy(p => 0)
            };

            foreach (var sort in req.Sorts.Skip(1))
            {
                var desc = sort.Order == -1;
                orderedQuery = sort.Field.ToLower() switch
                {
                    "sku" => desc ? orderedQuery.ThenByDescending(p => p.Sku) : orderedQuery.ThenBy(p => p.Sku),
                    "name" => desc ? orderedQuery.ThenByDescending(p => p.Name) : orderedQuery.ThenBy(p => p.Name),
                    "price" => desc ? orderedQuery.ThenByDescending(p => p.Price) : orderedQuery.ThenBy(p => p.Price),
                    "availablefrom" => desc ? orderedQuery.ThenByDescending(p => p.AvailableFrom) : orderedQuery.ThenBy(p => p.AvailableFrom),
                    "status" => desc ? orderedQuery.ThenByDescending(p => p.Status) : orderedQuery.ThenBy(p => p.Status),
                    "available" => desc ? orderedQuery.ThenByDescending(p => p.Available) : orderedQuery.ThenBy(p => p.Available),
                    _ => orderedQuery.ThenBy(p => 0)
                };
            }
            query = orderedQuery;
        }

        var totalCount = query.Count();

        var uuids = query
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(p => p.Uuid)
            .ToList();

        await Send.OkAsync(new SearchResponse { Uuids = uuids, TotalCount = totalCount }, ct);
    }
}

public static class SearchProductRequestExtensions
{
    public static IEnumerable<ProductDto> ApplyFilter(this IEnumerable<ProductDto> query, SearchProductRequest req)
    {
        if (!string.IsNullOrWhiteSpace(req.Sku))
            query = query.Where(p => p.Sku.Contains(req.Sku, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(req.Name))
            query = query.Where(p => p.Name.Contains(req.Name, StringComparison.OrdinalIgnoreCase));

        if (req.Price.HasValue)
            query = query.Where(p => p.Price <= req.Price.Value);

        if (req.AvailableFrom.HasValue)
            query = query.Where(p => p.AvailableFrom >= req.AvailableFrom.Value);

        return query;
    }
}

