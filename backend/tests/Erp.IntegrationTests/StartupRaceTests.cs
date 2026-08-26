using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Persistence;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Identity.Infrastructure.Persistence;
using Identity.Infrastructure.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// Kryterium akceptacji fazy 2 (<c>docs/backend/multi-instance.md</c> §10): <b>równoległy start
/// trzech instancji na pustej bazie</b>.
///
/// <para>To jest najostrzejsze ryzyko z całej listy wieloinstancyjnej — nie nieaktualny UI, tylko
/// potencjalnie uszkodzony schemat bazy. Dwa równoległe <c>MigrateAsync</c> wchodzą sobie
/// w <c>__EFMigrationsHistory</c> i w najgorszym razie zostawiają schemat zastosowany w połowie,
/// czyli awarię wymagającą ręcznej naprawy.</para>
///
/// <para>Instancje startują <b>naraz</b>, przez wspólną barierę — start rozjechany w czasie
/// nie sprawdziłby niczego, bo pierwsza instancja zdążyłaby skończyć, zanim druga zacznie.</para>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class StartupRaceTests
{
    private const int Instances = 3;

    private readonly PostgresFixture _postgres;

    public StartupRaceTests(PostgresFixture postgres) => _postgres = postgres;

    [Fact]
    public async Task Trzy_instancje_migruja_pusta_baze_bez_uszkodzenia_schematu()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var connectionString = await _postgres.CreateDatabaseAsync("migrate_race", cancellationToken);

        var providers = Enumerable.Range(0, Instances)
            .Select(_ => BuildCatalogInstance(connectionString))
            .ToList();

        try
        {
            await StartTogetherAsync(
                providers.Select(provider => (Func<CancellationToken, Task>)(async ct =>
                {
                    var migrator = new ErpDatabaseMigrator<CatalogDbContext>(
                        provider.GetRequiredService<IServiceScopeFactory>(),
                        provider.GetRequiredService<IConfiguration>(),
                        NullLogger<ErpDatabaseMigrator<CatalogDbContext>>.Instance);

                    await migrator.StartAsync(ct);
                })).ToList(),
                cancellationToken);

            await using var context = NewCatalogContext(connectionString);

            // Schemat kompletny: żadna migracja nie zawisła w połowie.
            var applied = await context.Database.GetAppliedMigrationsAsync(cancellationToken);
            var all = context.Database.GetMigrations();

            var appliedList = applied.OrderBy(m => m, StringComparer.Ordinal).ToList();
            var allList = all.OrderBy(m => m, StringComparer.Ordinal).ToList();

            appliedList.ShouldBe(allList);

            // Historia bez duplikatów — to po niej EF rozstrzyga, co jeszcze zastosować.
            appliedList.Distinct(StringComparer.Ordinal).Count().ShouldBe(appliedList.Count);

            // I baza faktycznie odpowiada na zapytanie o tabelę modułu.
            await context.Products.AsNoTracking().Take(1).ToListAsync(cancellationToken);
        }
        finally
        {
            foreach (var provider in providers)
            {
                await provider.DisposeAsync();
            }
        }
    }

    /// <summary>
    /// Katalog uprawnień uzgadnia się przy KAŻDYM starcie, nie tylko na pustej bazie — więc przy
    /// równoległym starcie wyścig na <c>INSERT</c> jest regułą, a nie wyjątkiem, i bez dzierżawy
    /// kończy się naruszeniem unikalności kodu uprawnienia, czyli wywróconym startem instancji.
    /// </summary>
    [Fact]
    public async Task Trzy_instancje_uzgadniaja_katalog_uprawnien_bez_duplikatow()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var connectionString = await _postgres.CreateDatabaseAsync("perm_race", cancellationToken);

        await using (var setup = NewIdentityContext(connectionString))
        {
            await setup.Database.MigrateAsync(cancellationToken);
        }

        var providers = Enumerable.Range(0, Instances)
            .Select(_ => BuildIdentityInstance(connectionString))
            .ToList();

        try
        {
            await StartTogetherAsync(
                providers.Select(provider => (Func<CancellationToken, Task>)(async ct =>
                {
                    var reconciler = new PermissionCatalogReconciler(
                        provider.GetRequiredService<IServiceScopeFactory>(),
                        NullLogger<PermissionCatalogReconciler>.Instance);

                    await reconciler.StartAsync(ct);
                })).ToList(),
                cancellationToken);

            await using var context = NewIdentityContext(connectionString);

            var codes = await context.PermissionCatalogEntries
                .AsNoTracking()
                .Select(entry => entry.Code)
                .ToListAsync(cancellationToken);

            codes.Count.ShouldBeGreaterThan(0);
            codes.Distinct(StringComparer.Ordinal).Count()
                .ShouldBe(codes.Count, "W katalogu uprawnień są duplikaty kodów.");
        }
        finally
        {
            foreach (var provider in providers)
            {
                await provider.DisposeAsync();
            }
        }
    }

    // ── Pomocnicze ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Puszcza wszystkie instancje w tej samej chwili. Bariera jest tu istotna: bez niej testy
    /// współbieżności przechodzą, bo nic się nie nakłada w czasie.
    /// </summary>
    private static async Task StartTogetherAsync(
        IReadOnlyList<Func<CancellationToken, Task>> starts,
        CancellationToken cancellationToken)
    {
        using var gate = new SemaphoreSlim(0, starts.Count);

        var running = starts
            .Select(start => Task.Run(async () =>
            {
                await gate.WaitAsync(cancellationToken);
                await start(cancellationToken);
            }, cancellationToken))
            .ToList();

        gate.Release(starts.Count);

        await Task.WhenAll(running).WaitAsync(TimeSpan.FromMinutes(3), cancellationToken);
    }

    private static ServiceProvider BuildCatalogInstance(string connectionString)
    {
        var services = new ServiceCollection();

        services.AddLogging();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                // W devie i w profilu wieloinstancyjnym flaga bywa włączona — i właśnie ten
                // przypadek tu sprawdzamy. Na produkcji migruje osobny krok wdrożenia.
                ["Database:MigrateOnStartup"] = "true",
            })
            .Build());

        services.AddDbContext<CatalogDbContext>(options => options.UseErpPostgres(
            connectionString,
            CatalogDbContext.SchemaName,
            typeof(CatalogDbContext).Assembly.GetName().Name));

        services.AddErpExclusiveLease<CatalogDbContext>();

        return services.BuildServiceProvider();
    }

    private static ServiceProvider BuildIdentityInstance(string connectionString)
    {
        var services = new ServiceCollection();

        services.AddLogging();
        services.AddDbContext<IdentityDbContext>(options => options.UseErpPostgres(
            connectionString,
            IdentityDbContext.SchemaName,
            typeof(IdentityDbContext).Assembly.GetName().Name));

        services.AddErpExclusiveLease<IdentityDbContext>();

        return services.BuildServiceProvider();
    }

    private static CatalogDbContext NewCatalogContext(string connectionString)
    {
        var builder = new DbContextOptionsBuilder<CatalogDbContext>();
        builder.UseErpPostgres(
            connectionString, CatalogDbContext.SchemaName, typeof(CatalogDbContext).Assembly.GetName().Name);

        return new CatalogDbContext(builder.Options);
    }

    private static IdentityDbContext NewIdentityContext(string connectionString)
    {
        var builder = new DbContextOptionsBuilder<IdentityDbContext>();
        builder.UseErpPostgres(
            connectionString, IdentityDbContext.SchemaName, typeof(IdentityDbContext).Assembly.GetName().Name);

        return new IdentityDbContext(builder.Options);
    }
}
