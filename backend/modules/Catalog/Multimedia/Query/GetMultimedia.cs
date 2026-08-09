using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Catalog.Multimedia.Query;

public class GetMultimediaRequest
{
    public List<Guid>? Uuids { get; set; }
}

public class GetMultimediaEndpoint : Endpoint<GetMultimediaRequest, List<MultimediaDto>>
{
    public override void Configure()
    {
        Post("getMultimedia");
        Group<MultimediaGroup>();
    }

    public override async Task HandleAsync(GetMultimediaRequest req, CancellationToken ct)
    {
        await CatalogMockData.SimulateQueryDelayAsync(ct);

        var result = CatalogMockData.Multimedias;

        if (req.Uuids != null && req.Uuids.Any())
        {
            result = result.Where(p => req.Uuids.Contains(p.Uuid)).ToList();
        }

        await Send.OkAsync(result, ct);
    }
}
