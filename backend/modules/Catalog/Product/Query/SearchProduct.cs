using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;
using Catalog.Common;

namespace Catalog.Product.Query;

public class SearchProductRequest : PagedRequest
{
    public Guid? ProductId { get; set; }
    public Guid? ModelId { get; set; }
    public string? ProductType { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? Category { get; set; }
    public string? Attribute { get; set; }
    public string? ProductCode { get; set; }
    public string? TerritoryCode { get; set; }
    public bool? SummaryReport { get; set; }
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
        if (req.ProductId.HasValue)
            query = query.Where(p => p.Uuid == req.ProductId.Value);

        if (req.ModelId.HasValue)
            query = query.Where(p => p.ModelUuid == req.ModelId.Value);

        if (!string.IsNullOrWhiteSpace(req.ProductCode))
            query = query.Where(p => p.Sku.Contains(req.ProductCode, StringComparison.OrdinalIgnoreCase) || p.Ean.Contains(req.ProductCode, StringComparison.OrdinalIgnoreCase));

        return query;
    }
}

