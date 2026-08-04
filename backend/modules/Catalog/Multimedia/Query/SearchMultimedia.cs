using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;
using Catalog.Common;

namespace Catalog.Multimedia.Query;

public class SearchMultimediaRequest : PagedRequest
{
    public List<Guid>? Uuids { get; set; }
}

public class SearchMultimediaEndpoint : Endpoint<SearchMultimediaRequest, SearchResponse>
{
    public override void Configure()
    {
        Post("searchMultimedia");
        Group<MultimediaGroup>();
    }

    public override async Task HandleAsync(SearchMultimediaRequest req, CancellationToken ct)
    {
        var query = CatalogMockData.Multimedias.AsEnumerable();

        if (req.Uuids != null && req.Uuids.Any())
        {
            query = query.Where(p => req.Uuids.Contains(p.Uuid));
        }

        if (req.Sorts != null && req.Sorts.Any())
        {
            var firstSort = req.Sorts.First();
            var isDesc = firstSort.Order == -1;
            var orderedQuery = firstSort.Field.ToLower() switch
            {
                "filename" => isDesc ? query.OrderByDescending(p => p.FileName) : query.OrderBy(p => p.FileName),
                "sortorder" => isDesc ? query.OrderByDescending(p => p.SortOrder) : query.OrderBy(p => p.SortOrder),
                "createdat" => isDesc ? query.OrderByDescending(p => p.CreatedAt) : query.OrderBy(p => p.CreatedAt),
                _ => query.OrderBy(p => 0)
            };
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
