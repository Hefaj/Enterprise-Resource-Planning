using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using Notification.Application.Jobs;

namespace Notification.Jobs.Query;

/// <summary>Pobranie zadań z repliki po identyfikatorach. Celowo bez <c>Permissions(...)</c> —
/// patrz uzasadnienie w <c>SearchJobEndpoint</c> (własny feed powiadomień, nie zasób uprzywilejowany).
///
/// <para>Wynik jest zawężony do zadań zalogowanego użytkownika, tak samo jak w <c>SearchJobEndpoint</c>.
/// Bez tego samo uuid zadania wystarczyłoby, żeby odczytać cudzy wiersz razem z <c>commandJson</c>
/// i <c>uiMetadata</c>.</para>
/// </summary>
public sealed class GetJobEndpoint : Endpoint<GetJobRequest, List<JobDto>>
{
    private readonly IJobQueries _queries;
    private readonly IExecutionContext _executionContext;

    public GetJobEndpoint(IJobQueries queries, IExecutionContext executionContext)
    {
        _queries = queries;
        _executionContext = executionContext;
    }

    public override void Configure()
    {
        Post("getJob");
        Group<JobGroup>();
    }

    public override async Task HandleAsync(GetJobRequest req, CancellationToken ct)
    {
        var userId = _executionContext.UserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            await Send.OkAsync([], ct);
            return;
        }

        var jobs = await _queries.GetAsync(req.Uuids, userId, ct);
        await Send.OkAsync(jobs, ct);
    }
}
