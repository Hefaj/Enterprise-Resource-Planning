using FastEndpoints;
using Notification.Application.Contracts;

namespace Notification.Job.Query;

/// <summary>Pobranie zadań z repliki po identyfikatorach.</summary>
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
