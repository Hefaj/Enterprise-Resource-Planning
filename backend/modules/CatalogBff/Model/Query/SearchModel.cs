using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;
using CatalogBff.Common;

namespace CatalogBff.Model.Query;

public class SearchModelRequest : PagedRequest
{
    public string? Name { get; set; }
}

public class SearchModelEndpoint : Endpoint<SearchModelRequest, List<Guid>>
{
    public override void Configure()
    {
        Post("searchModel");
        Group<ModelGroup>();
    }

    public override async Task HandleAsync(SearchModelRequest req, CancellationToken ct)
    {
        var query = CatalogMockData.Models.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            query = query.Where(m => m.Name.Contains(req.Name, StringComparison.OrdinalIgnoreCase));
        }

        var uuids = query
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .Select(m => m.Uuid)
            .ToList();
            
        await Send.OkAsync(uuids, ct);
    }
}

