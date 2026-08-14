using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Erp.BuildingBlocks.Persistence;

/// <summary>
/// Stosuje zaległe migracje przy starcie modułów, które — w przeciwieństwie do Catalogu —
/// nie mają własnych danych startowych do zasiania (Notification: replika jest karmiona
/// wyłącznie zdarzeniami, nie ma czego seedować).
///
/// Jak w <c>Catalog.Infrastructure.Persistence.CatalogDatabaseInitializer</c>: wygoda
/// deweloperska, nie wzorzec produkcyjny — przy wielu instancjach każda próbowałaby migrować
/// równolegle. Sterowane flagą <c>Database:MigrateOnStartup</c>.
/// </summary>
/// <typeparam name="TContext">Kontekst modułu do migrowania.</typeparam>
public sealed partial class ErpDatabaseMigrator<TContext> : IHostedService
    where TContext : ErpDbContext
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ErpDatabaseMigrator<TContext>> _logger;
    private readonly bool _migrateOnStartup;

    public ErpDatabaseMigrator(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<ErpDatabaseMigrator<TContext>> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        _scopeFactory = scopeFactory;
        _logger = logger;
        _migrateOnStartup = configuration.GetValue("Database:MigrateOnStartup", defaultValue: false);
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_migrateOnStartup)
        {
            return;
        }

        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<TContext>();

        LogMigrating(_logger, typeof(TContext).Name);
        await dbContext.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Stosowanie migracji bazy {Context}…")]
    private static partial void LogMigrating(ILogger logger, string context);
}
