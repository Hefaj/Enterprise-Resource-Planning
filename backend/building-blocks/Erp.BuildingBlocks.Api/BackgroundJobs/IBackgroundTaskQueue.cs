using System;
using System.Threading;
using System.Threading.Tasks;

namespace Erp.BuildingBlocks.Api.BackgroundJobs;

// CA1711 ostrzega przed sufiksem "Queue" w nazwie typu. Tutaj jest on trafny —
// to dosłownie kolejka zadań — więc regułę wyłączamy punktowo zamiast psuć nazwę.
#pragma warning disable CA1711

public interface IBackgroundTaskQueue
{
    ValueTask QueueBackgroundWorkItemAsync(Func<CancellationToken, ValueTask> workItem);

    ValueTask<Func<CancellationToken, ValueTask>> DequeueAsync(CancellationToken cancellationToken);
}
#pragma warning restore CA1711
