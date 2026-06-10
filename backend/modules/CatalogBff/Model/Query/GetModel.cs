using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace CatalogBff.Model.Query;

public class GetModelRequest
{
    public List<Guid>? Uuids { get; set; }
}

public class GetModelEndpoint : Endpoint<GetModelRequest, List<ModelDto>>
{
    public override void Configure()
    {
        Post("getModel");
        Group<ModelGroup>();
    }

    public override async Task HandleAsync(GetModelRequest req, CancellationToken ct)
    {
        var result = CatalogMockData.Models;

        if (req.Uuids != null && req.Uuids.Any())
        {
            result = result.Where(m => req.Uuids.Contains(m.Uuid)).ToList();
        }

        await Send.OkAsync(result, ct);
    }
}
