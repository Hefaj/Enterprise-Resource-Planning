using Catalog.Domain.Products;
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

        if (_migrateOnStartup)
        {
            await BackfillDuplicateKeysAsync(dbContext, cancellationToken).ConfigureAwait(false);
        }

        if (_seedOptions.Enabled)
        {
            var seeder = scope.ServiceProvider.GetRequiredService<CatalogSeeder>();
            await seeder.SeedAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    /// <summary>
    /// Uzupełnia <c>duplicate_key</c> dla produktów sprzed migracji wprowadzającej sygnaturę.
    ///
    /// <para>Migracja celowo zostawia kolumnę pustą — dzięki temu utworzenie unikalnego indeksu
    /// nie może paść na istniejących danych i wdrożenie nigdy nie blokuje się na duplikatach
    /// zastanych w bazie. Ceną jest ten krok: klucz trzeba policzyć w C#, bo liczy go
    /// <see cref="Product.ComputeDuplicateKey"/>, a odtworzenie tego samego skrótu w SQL-u
    /// byłoby drugą implementacją tej samej definicji.</para>
    ///
    /// <para>Kolizje w danych zastanych są <b>logowane, a nie rzucane</b>: istniejący duplikat
    /// to informacja do rozstrzygnięcia biznesowego, a nie powód, by serwis się nie podniósł.
    /// Kolidujące produkty zostają z <c>NULL</c> i nie uczestniczą w regule, dopóki ktoś
    /// nie zmieni ich klasyfikacji — wtedy przejdą normalną ścieżką walidacji.</para>
    /// </summary>
    private async Task BackfillDuplicateKeysAsync(CatalogDbContext dbContext, CancellationToken cancellationToken)
    {
        var pending = await dbContext.Products
            .Where(p => p.DuplicateKey == null && p.ModelUuid != null)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (pending.Count == 0)
        {
            return;
        }

        // Klucze już zajęte przez wiersze uzupełnione we wcześniejszym przebiegu — bez nich
        // backfill kolidowałby z danymi, których sam nie wczytał.
        var taken = new HashSet<string>(
            await dbContext.Products
                .Where(p => p.DuplicateKey != null)
                .Select(p => p.DuplicateKey!)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false),
            StringComparer.Ordinal);

        var filled = 0;
        var collisions = new List<Guid>();

        foreach (var product in pending)
        {
            var key = Product.ComputeDuplicateKey(product.ModelUuid, product.CategoryUuids);

            if (key is null || !taken.Add(key))
            {
                collisions.Add(product.Uuid);
                continue;
            }

            // Ta sama ścieżka co przy zwykłym zapisie — agregat sam liczy sygnaturę,
            // backfill nie ustawia kolumny z zewnątrz.
            product.AssignToModel(product.ModelUuid);
            filled++;
        }

        if (filled > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        LogDuplicateKeysBackfilled(_logger, filled, collisions.Count);

        if (collisions.Count > 0)
        {
            LogDuplicateKeyCollisions(_logger, collisions.Count, string.Join(", ", collisions.Take(10)));
        }
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "Stosowanie migracji bazy Catalog…")]
    private static partial void LogMigrating(ILogger logger);

    [LoggerMessage(EventId = 2, Level = LogLevel.Information,
        Message = "Uzupełniono sygnaturę duplikatu dla {Filled} produktów ({Collisions} pominiętych).")]
    private static partial void LogDuplicateKeysBackfilled(ILogger logger, int filled, int collisions);

    [LoggerMessage(EventId = 3, Level = LogLevel.Warning,
        Message = "W danych zastanych jest {Count} produktów o powtórzonej klasyfikacji "
                + "(ten sam model i kategorie) — zostają bez sygnatury duplikatu. Przykłady: {Examples}.")]
    private static partial void LogDuplicateKeyCollisions(ILogger logger, int count, string examples);
}
