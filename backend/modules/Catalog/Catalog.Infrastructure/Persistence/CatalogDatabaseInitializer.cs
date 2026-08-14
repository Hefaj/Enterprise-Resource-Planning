using Catalog.Infrastructure.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Catalog.Infrastructure.Persistence;

/// <summary>
/// Przygotowuje bazę przy starcie: stosuje zaległe migracje i — jeśli włączone — zasila
/// danymi przykładowymi.
///
/// Automatyczne migrowanie przy starcie jest wygodą deweloperską, nie wzorcem produkcyjnym:
/// przy wielu instancjach serwisu każda próbowałaby migrować równolegle, a nieudana migracja
/// przewracałaby aplikację zamiast zatrzymać wdrożenie. Na produkcji migracje uruchamia osobny
/// krok pipeline'u, dlatego całość jest sterowana flagą <c>Database:MigrateOnStartup</c>.
/// </summary>
public sealed partial class CatalogDatabaseInitializer : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly CatalogSeedOptions _seedOptions;
    private readonly ILogger<CatalogDatabaseInitializer> _logger;
    private readonly bool _migrateOnStartup;

    public CatalogDatabaseInitializer(
        IServiceScopeFactory scopeFactory,
        CatalogSeedOptions seedOptions,
        IConfiguration configuration,
        ILogger<CatalogDatabaseInitializer> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        _scopeFactory = scopeFactory;
        _seedOptions = seedOptions;
        _logger = logger;
        _migrateOnStartup = configuration.GetValue("Database:MigrateOnStartup", defaultValue: false);
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();

        if (_migrateOnStartup)
        {
            LogMigrating(_logger);
            await dbContext.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        }

        if (_seedOptions.Enabled)
        {
            var seeder = scope.ServiceProvider.GetRequiredService<CatalogSeeder>();
            await seeder.SeedAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Stosowanie migracji bazy Catalog…")]
    private static partial void LogMigrating(ILogger logger);
}
