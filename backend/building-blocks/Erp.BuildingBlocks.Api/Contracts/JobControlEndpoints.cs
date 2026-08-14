using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace Erp.BuildingBlocks.Api.Contracts;

/// <summary>Żądanie sterujące zadaniem masowym po jego identyfikatorze.</summary>
public sealed class JobControlRequest
{
    public Guid JobUuid { get; set; }
}

/// <summary>Wynik anulowania — status zwrócony od razu, bez czekania na runner.</summary>
public sealed class JobCancelResult
{
    public Guid JobUuid { get; set; }

    public string Status { get; set; } = string.Empty;
}

/// <summary>
/// Anuluje zadanie masowe. Zmienia wyłącznie status — <c>BulkCommandRunner</c> sam sprawdza
/// go przed każdym chunkiem (patrz <c>TryProcessAsync</c>), więc elementy w trakcie
/// przetwarzania kończą swój bieżący chunk, a kolejne już nie startują. Anulowanie
/// nie cofa tego, co już się zapisało.
/// </summary>
/// <typeparam name="TContext">Kontekst modułu będącego właścicielem zadania.</typeparam>
public abstract class JobCancelEndpointBase<TContext> : Endpoint<JobControlRequest, JobCancelResult>
    where TContext : ErpDbContext, IJobDbContext
{
    public override async Task HandleAsync(JobControlRequest req, CancellationToken ct)
    {
        var db = Resolve<TContext>();
        var clock = Resolve<IClock>();
        var unitOfWork = Resolve<IUnitOfWork>();

        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Uuid == req.JobUuid, ct).ConfigureAwait(false);
        if (job is null)
        {
            await Send.NotFoundAsync(ct).ConfigureAwait(false);
            return;
        }

        job.Cancel(clock.UtcNow);
        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        await Send.OkAsync(
            new JobCancelResult { JobUuid = job.Uuid, Status = job.Status.ToString() },
            ct).ConfigureAwait(false);
    }
}

/// <summary>Wynik ponowienia — identyfikator nowo utworzonego zadania.</summary>
public sealed class JobRetryFailedResult
{
    public Guid NewJobUuid { get; set; }
}

/// <summary>
/// Ponawia nieudane elementy zakończonego zadania jako NOWE zadanie, nie modyfikując
/// oryginału — historia wykonania (kto, kiedy, z jakim wynikiem) zostaje nietknięta,
/// zgodnie z zasadą, że <c>job_item</c> to zapis tego, co faktycznie się wydarzyło.
///
/// Każdy ponawiany element niesie WŁASNY zapisany payload (<c>JobItem.CommandJson</c>),
/// jeśli go miał (tryb listy różnych komend) — inaczej nowe zadanie dziedziczy szablon
/// oryginału. Dzięki temu ponowienie odtwarza dokładnie to, co się nie udało, a nie
/// jego przybliżenie.
/// </summary>
/// <typeparam name="TContext">Kontekst modułu będącego właścicielem zadania.</typeparam>
public abstract class JobRetryFailedEndpointBase<TContext> : Endpoint<JobControlRequest, JobRetryFailedResult>
    where TContext : ErpDbContext, IJobDbContext
{
    public override async Task HandleAsync(JobControlRequest req, CancellationToken ct)
    {
        var db = Resolve<TContext>();
        var jobStore = Resolve<IJobStore>();

        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Uuid == req.JobUuid, ct).ConfigureAwait(false);
        if (job is null)
        {
            await Send.NotFoundAsync(ct).ConfigureAwait(false);
            return;
        }

        var failedItems = await db.JobItems
            .Where(i => i.JobUuid == req.JobUuid && i.Status == JobItemStatus.Failed)
            .OrderBy(i => i.Ordinal)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (failedItems.Count == 0)
        {
            ThrowError("Zadanie nie ma nieudanych elementów do ponowienia.");
            return;
        }

        var targets = failedItems
            .Select(i => new JobTarget(i.AggregateUuid, i.CommandJson))
            .ToList();

        var newJobUuid = await jobStore
            .CreateAsync(job.CommandType, job.CommandJson, targets, job.QueueId, job.UiMetadata, null, ct)
            .ConfigureAwait(false);

        await Send.OkAsync(new JobRetryFailedResult { NewJobUuid = newJobUuid }, ct).ConfigureAwait(false);
    }
}
