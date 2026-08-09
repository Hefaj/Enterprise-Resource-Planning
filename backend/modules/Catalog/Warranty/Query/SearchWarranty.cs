using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;
using Catalog.Common;

namespace Catalog.Warranty.Query;

public class SearchWarrantyRequest : PagedRequest
{
    public Guid? WarrantyId { get; set; }
    public string? Name { get; set; }
}

public class SearchWarrantyEndpoint : Endpoint<SearchWarrantyRequest, SearchResponse>
{
    public override void Configure()
    {
        Post("searchWarranty");
        Group<WarrantyGroup>();
    }

    public override async Task HandleAsync(SearchWarrantyRequest req, CancellationToken ct)
    {
        await CatalogMockData.SimulateQueryDelayAsync(ct);

        var query = CatalogMockData.Warranties.AsEnumerable().ApplyFilter(req);

        if (req.Sorts != null && req.Sorts.Any())
        {
            var firstSort = req.Sorts.First();
            var isDesc = firstSort.Order == -1;
            var orderedQuery = firstSort.Field.ToLower() switch
            {
                "name" => isDesc ? query.OrderByDescending(p => p.Name) : query.OrderBy(p => p.Name),
                "durationmonths" => isDesc ? query.OrderByDescending(p => p.DurationMonths) : query.OrderBy(p => p.DurationMonths),
                _ => query.OrderBy(p => 0)
            };

            foreach (var sort in req.Sorts.Skip(1))
            {
                var desc = sort.Order == -1;
                orderedQuery = sort.Field.ToLower() switch
                {
                    "name" => desc ? orderedQuery.ThenByDescending(p => p.Name) : orderedQuery.ThenBy(p => p.Name),
                    "durationmonths" => desc ? orderedQuery.ThenByDescending(p => p.DurationMonths) : orderedQuery.ThenBy(p => p.DurationMonths),
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

public static class SearchWarrantyRequestExtensions
{
    public static IEnumerable<WarrantyDto> ApplyFilter(this IEnumerable<WarrantyDto> query, SearchWarrantyRequest req)
    {
        if (req.WarrantyId.HasValue)
            query = query.Where(p => p.Uuid == req.WarrantyId.Value);

        if (!string.IsNullOrWhiteSpace(req.Name))
            query = query.Where(p => p.Name.Contains(req.Name, StringComparison.OrdinalIgnoreCase));

        return query;
    }
}
