using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;
using Catalog.Common;

namespace Catalog.Model.Query;

public class SearchModelRequest : PagedRequest
{
    public string? Name { get; set; }
}

public class SearchModelEndpoint : Endpoint<SearchModelRequest, SearchResponse>
{
    public override void Configure()
    {
        Post("searchModel");
        Group<ModelGroup>();
    }

    public override async Task HandleAsync(SearchModelRequest req, CancellationToken ct)
    {
        await CatalogMockData.SimulateQueryDelayAsync(ct);

        var query = CatalogMockData.Models.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            query = query.Where(m => m.Name.Contains(req.Name, StringComparison.OrdinalIgnoreCase));
        }

        if (req.Sorts != null && req.Sorts.Any())
        {
            var firstSort = req.Sorts.First();
            var isDesc = firstSort.Order == -1;
            var orderedQuery = firstSort.Field.ToLower() switch
            {
                "name" => isDesc ? query.OrderByDescending(m => m.Name) : query.OrderBy(m => m.Name),
                _ => query.OrderBy(m => 0)
            };

            foreach (var sort in req.Sorts.Skip(1))
            {
                var desc = sort.Order == -1;
                orderedQuery = sort.Field.ToLower() switch
                {
                    "name" => desc ? orderedQuery.ThenByDescending(m => m.Name) : orderedQuery.ThenBy(m => m.Name),
                    _ => orderedQuery.ThenBy(m => 0)
                };
            }
            query = orderedQuery;
        }

        var totalCount = query.Count();

        var uuids = query
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(m => m.Uuid)
            .ToList();

        await Send.OkAsync(new SearchResponse { Uuids = uuids, TotalCount = totalCount }, ct);
    }
}

