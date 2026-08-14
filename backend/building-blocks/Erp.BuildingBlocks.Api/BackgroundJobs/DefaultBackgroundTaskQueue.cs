using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace Erp.BuildingBlocks.Api.BackgroundJobs;

// CA1711 ostrzega przed sufiksem "Queue" w nazwie typu. Tutaj jest on trafny —
// to dosłownie kolejka zadań — więc regułę wyłączamy punktowo zamiast psuć nazwę.
#pragma warning disable CA1711

public class DefaultBackgroundTaskQueue : IBackgroundTaskQueue
{
    private readonly Channel<Func<CancellationToken, ValueTask>> _queue;

    public DefaultBackgroundTaskQueue(int capacity = 1000)
    {
        // Utworzenie ograniczonej kolejki BoundedChannel zapobiega OutOfMemoryException
        var options = new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait
        };
        _queue = Channel.CreateBounded<Func<CancellationToken, ValueTask>>(options);
    }

    public async ValueTask QueueBackgroundWorkItemAsync(Func<CancellationToken, ValueTask> workItem)
    {
        ArgumentNullException.ThrowIfNull(workItem);

        await _queue.Writer.WriteAsync(workItem);
    }

    public async ValueTask<Func<CancellationToken, ValueTask>> DequeueAsync(CancellationToken cancellationToken)
    {
        var workItem = await _queue.Reader.ReadAsync(cancellationToken);
        return workItem;
    }
}
#pragma warning restore CA1711
