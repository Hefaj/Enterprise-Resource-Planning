using FastEndpoints;
using System;
using System.Collections.Generic;
using System.Linq;

namespace NotificationBff.Job.Query;

public class GetJobRequest
{
    public List<Guid>? Uuids { get; set; }
}

public class GetJobEndpoint : Endpoint<GetJobRequest, List<JobDto>>
{
    public override void Configure()
    {
        Post("getJob");
        Group<JobGroup>();
    }

    public override async Task HandleAsync(GetJobRequest req, CancellationToken ct)
    {
        var result = NotificationMockData.Jobs;

        if (req.Uuids != null && req.Uuids.Any())
        {
            result = result.Where(j => req.Uuids.Contains(j.Uuid)).ToList();
        }

        await Send.OkAsync(result, ct);
    }
}
