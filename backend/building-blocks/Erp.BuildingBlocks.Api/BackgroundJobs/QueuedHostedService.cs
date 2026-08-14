using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace Erp.BuildingBlocks.Api.BackgroundJobs;

public partial class QueuedHostedService : BackgroundService
{
    private readonly ILogger<QueuedHostedService> _logger;
    private readonly IServiceScopeFactory _serviceScopeFactory;
    public IBackgroundTaskQueue TaskQueue { get; }

    public QueuedHostedService(
        IBackgroundTaskQueue taskQueue,
        ILogger<QueuedHostedService> logger,
        IServiceScopeFactory serviceScopeFactory)
    {
        TaskQueue = taskQueue;
        _logger = logger;
        _serviceScopeFactory = serviceScopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogStarted(_logger);
        await BackgroundProcessing(stoppingToken);
    }

    private async Task BackgroundProcessing(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var workItem = await TaskQueue.DequeueAsync(stoppingToken);

            try
            {
                // Tworzymy nowy Scope dla wstrzykiwania zależności w tle.
                // Dzięki temu serwisy typu Scoped będą żyły tylko na czas tego zadania.
                using var scope = _serviceScopeFactory.CreateScope();
                
                // Możesz przekazać scope.ServiceProvider w razie potrzeby (tu używamy closure).
                await workItem(stoppingToken);
            }
            catch (Exception ex)
            {
                LogWorkItemFailed(_logger, ex);
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        LogStopping(_logger);
        await base.StopAsync(cancellationToken);
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Queued Hosted Service is running.")]
    private static partial void LogStarted(ILogger logger);

    [LoggerMessage(EventId = 2, Level = LogLevel.Information, Message = "Queued Hosted Service is stopping.")]
    private static partial void LogStopping(ILogger logger);

    [LoggerMessage(EventId = 3, Level = LogLevel.Error, Message = "Error occurred executing background work item.")]
    private static partial void LogWorkItemFailed(ILogger logger, Exception exception);
}
