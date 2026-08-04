using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Catalog.Warranty.Query;

public class GetWarrantyRequest
{
    public List<Guid>? Uuids { get; set; }
}

public class GetWarrantyEndpoint : Endpoint<GetWarrantyRequest, List<WarrantyDto>>
{
    public override void Configure()
    {
        Post("getWarranty");
        Group<WarrantyGroup>();
    }

    public override async Task HandleAsync(GetWarrantyRequest req, CancellationToken ct)
    {
        var result = CatalogMockData.Warranties;

        if (req.Uuids != null && req.Uuids.Any())
        {
            result = result.Where(p => req.Uuids.Contains(p.Uuid)).ToList();
        }

        await Send.OkAsync(result, ct);
    }
}
