using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CatalogBff.Model.Query;

public class SearchModelRequest
{
    public string? Name { get; set; }
}

public class SearchModelEndpoint : Endpoint<SearchModelRequest, List<Guid>>
{
    public override void Configure()
    {
        Post("search");
        Group<ModelGroup>();
    }

    public override async Task HandleAsync(SearchModelRequest req, CancellationToken ct)
    {
        var query = CatalogMockData.Models.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(req.Name))
        {
            query = query.Where(m => m.Name.Contains(req.Name, StringComparison.OrdinalIgnoreCase));
        }

        var uuids = query.Select(m => m.Uuid).ToList();
        await Send.OkAsync(uuids, ct);
    }
}
