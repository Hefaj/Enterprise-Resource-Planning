using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace CatalogBff.Common.BackgroundJobs;

public class QueuedHostedService : BackgroundService
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
        _logger.LogInformation("Queued Hosted Service is running.");
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
                _logger.LogError(ex, "Error occurred executing background work item.");
            }
        }
    }

    public override async Task StopAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Queued Hosted Service is stopping.");
        await base.StopAsync(stoppingToken);
    }
}
