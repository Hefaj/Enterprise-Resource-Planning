using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Persistence.Concurrency;
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
/// <para><b>Migrowanie przy starcie jest wygodą deweloperską, nie wzorcem produkcyjnym</b>,
/// i dlatego domyślną wartością <c>Database:MigrateOnStartup</c> jest <c>false</c>. Na produkcji
/// schemat stosuje osobny krok wdrożenia (<c>dotnet ef database update</c> albo bundle
/// uruchamiany PRZED rolloutem instancji) — tylko wtedy nieudana migracja zatrzymuje wdrożenie,
/// zamiast przewracać aplikację przy starcie.</para>
///
/// <para><b>Gdy flaga jednak jest włączona</b> (dev, testy integracyjne, docker-compose),
/// migracja idzie pod <b>blokującą</b> dzierżawą. Dwa równoległe <c>MigrateAsync</c> wchodzą
/// sobie w <c>__EFMigrationsHistory</c> i w najgorszym razie zostawiają schemat zastosowany
/// w połowie — to awaria wymagająca ręcznej naprawy bazy, więc najostrzejsze ryzyko z całej
/// listy wieloinstancyjnej. Dzierżawa jest tu <b>blokująca, a nie próbująca</b>: instancja B ma
/// zobaczyć zmigrowany schemat, zanim ruszy dalej, a nie pominąć krok i wystartować na starym.</para>
/// </summary>
/// <typeparam name="TContext">Kontekst modułu do migrowania.</typeparam>
[ClusterSafe("Migracja pod blokującą dzierżawą {kontekst}:migrate — instancja B czeka i zastaje "
    + "zmigrowany schemat; na produkcji flaga MigrateOnStartup jest wyłączona i migruje wdrożenie.")]
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

        var lease = scope.ServiceProvider.GetRequiredService<IExclusiveLease>();
        await using var held = await lease
            .AcquireAsync($"{typeof(TContext).Name}:migrate", cancellationToken)
            .ConfigureAwait(false);

        var dbContext = scope.ServiceProvider.GetRequiredService<TContext>();

        LogMigrating(_logger, typeof(TContext).Name);
        await dbContext.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Stosowanie migracji bazy {Context}…")]
    private static partial void LogMigrating(ILogger logger, string context);
}
