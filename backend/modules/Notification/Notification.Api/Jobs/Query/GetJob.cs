using FastEndpoints;
using Notification.Application.Jobs;

namespace Notification.Jobs.Query;

/// <summary>Pobranie zadań z repliki po identyfikatorach. Celowo bez <c>Permissions(...)</c> —
/// patrz uzasadnienie w <c>SearchJobEndpoint</c> (własny feed powiadomień, nie zasób uprzywilejowany).
public sealed class GetJobEndpoint : Endpoint<GetJobRequest, List<JobDto>>
{
    private readonly IJobQueries _queries;

    public GetJobEndpoint(IJobQueries queries) => _queries = queries;

    public override void Configure()
    {
        Post("getJob");
        Group<JobGroup>();
    }

    public override async Task HandleAsync(GetJobRequest req, CancellationToken ct)
    {
        var jobs = await _queries.GetAsync(req.Uuids, ct);
        await Send.OkAsync(jobs, ct);
    }
}
