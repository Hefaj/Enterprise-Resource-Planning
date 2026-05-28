using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;
using CatalogBff.Common;

namespace CatalogBff.Category.Query;

public class SearchCategoryRequest : PagedRequest
{
    public string? Name { get; set; }
}

public class SearchCategoryEndpoint : Endpoint<SearchCategoryRequest, SearchResponse>
{
    public override void Configure()
    {
        Post("searchCategory");
        Group<CategoryGroup>();
    }

    public override async Task HandleAsync(SearchCategoryRequest req, CancellationToken ct)
    {
        var query = CatalogMockData.Categories.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            query = query.Where(c => c.Name.Contains(req.Name, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(req.SortField))
        {
            var isDesc = req.SortOrder == -1;
            query = req.SortField.ToLower() switch
            {
                "name" => isDesc ? query.OrderByDescending(c => c.Name) : query.OrderBy(c => c.Name),
                _ => query
            };
        }

        var totalCount = query.Count();

        var uuids = query
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(c => c.Uuid)
            .ToList();
            
        await Send.OkAsync(new SearchResponse { Uuids = uuids, TotalCount = totalCount }, ct);
    }
}

