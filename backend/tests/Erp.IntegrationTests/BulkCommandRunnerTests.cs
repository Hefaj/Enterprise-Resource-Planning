using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Jobs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shouldly;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// Kryteria akceptacji fazy 1 z <c>docs/backend/multi-instance.md</c> §10 — <b>dwa</b> runnery
/// nad jednym Postgresem.
///
/// <para>Test mierzy to, co faktycznie boli przy dwóch instancjach, a nie samą „obecność locka":
/// czy liczniki zadania zgadzają się z liczbą elementów, czy w bazie nie wylądował ani jeden
/// <c>concurrency_conflict</c> i — najważniejsze — czy skutek uboczny wykonał się dokładnie raz
/// na element. Przed fazą 1 każde z tych trzech pytań miało złą odpowiedź.</para>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class BulkCommandRunnerTests
{
    private const int ItemCount = 5000;

    private readonly PostgresFixture _postgres;

    public BulkCommandRunnerTests(PostgresFixture postgres) => _postgres = postgres;

    [Fact]
    public async Task Dwa_runnery_wykonuja_kazdy_element_dokladnie_raz()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var schema = PostgresFixture.NewSchemaName("bulk");

        await using var instanceA = BulkTestInstance.Build(_postgres.ConnectionString, schema);
        await using var instanceB = BulkTestInstance.Build(_postgres.ConnectionString, schema);

        await CreateSchemaAsync(instanceA, schema, cancellationToken);
        var jobUuid = await SeedJobAsync(instanceA, ItemCount, cancellationToken);

        await RunUntilFinishedAsync([instanceA, instanceB], jobUuid, cancellationToken);

        using var scope = instanceA.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BulkTestDbContext>();

        var job = await db.Jobs.AsNoTracking().FirstAsync(j => j.Uuid == jobUuid, cancellationToken);

        job.Status.ShouldBe(JobStatus.Completed);
        (job.SucceededCount + job.FailedCount).ShouldBe(job.TotalCount);
        job.SucceededCount.ShouldBe(ItemCount);

        var conflicts = await db.JobItems.AsNoTracking()
            .CountAsync(i => i.JobUuid == jobUuid && i.ErrorCode == "concurrency_conflict", cancellationToken);
        conflicts.ShouldBe(0, "Runnery weszły sobie w drogę — xmin wyłapał konflikt na zapisie chunka.");

        // Dowód właściwy: skutek uboczny w danych, nie licznik prób runnera.
        var touchCounts = await db.Counters.AsNoTracking()
            .GroupBy(c => c.Touches)
            .Select(g => new { Touches = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        touchCounts.Count.ShouldBe(1, "Elementy wykonały się różną liczbę razy: "
            + string.Join(", ", touchCounts.Select(t => $"{t.Count}× po {t.Touches}")));
        touchCounts[0].Touches.ShouldBe(1);
        touchCounts[0].Count.ShouldBe(ItemCount);
    }

    /// <summary>
    /// Druga własność <c>SKIP LOCKED</c>, równie istotna jak wyłączność: runnery <b>nie ustawiają
    /// się w kolejce</b> do jednego zadania. Bez pomijania flota zdegenerowałaby się do jednego
    /// pracującego procesu — wyłączność byłaby zachowana, a skalowanie nie.
    /// </summary>
    [Fact]
    public async Task Dwa_zadania_ida_rownolegle_a_nie_po_kolei()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var schema = PostgresFixture.NewSchemaName("bulk");

        await using var instance = BulkTestInstance.Build(_postgres.ConnectionString, schema);

        await CreateSchemaAsync(instance, schema, cancellationToken);

        var first = await SeedJobAsync(instance, itemCount: 10, cancellationToken);

        // Odstęp, żeby `ORDER BY created_at` miało jednoznaczną kolejność — bez niego oba
        // zadania mogą trafić w tę samą mikrosekundę i test sprawdzałby losowanie Postgresa.
        await Task.Delay(20, cancellationToken);

        var second = await SeedJobAsync(instance, itemCount: 10, cancellationToken);

        using var scopeA = instance.CreateScope();
        using var scopeB = instance.CreateScope();

        var dbA = scopeA.ServiceProvider.GetRequiredService<BulkTestDbContext>();
        var dbB = scopeB.ServiceProvider.GetRequiredService<BulkTestDbContext>();

        await using var transactionA = await dbA.Database.BeginTransactionAsync(cancellationToken);
        await using var transactionB = await dbB.Database.BeginTransactionAsync(cancellationToken);

        var lockedByA = await scopeA.ServiceProvider.GetRequiredService<JobQueueLock<BulkTestDbContext>>()
            .TryLockNextAsync(dbA, JobKind.Map, cancellationToken);

        var lockedByB = await scopeB.ServiceProvider.GetRequiredService<JobQueueLock<BulkTestDbContext>>()
            .TryLockNextAsync(dbB, JobKind.Map, cancellationToken);

        lockedByA.ShouldBe(first);
        lockedByB.ShouldBe(second, "Runner B zaczekał na zadanie A zamiast wziąć następne wolne.");
    }

    /// <summary>
    /// Gdy wolnych zadań nie ma, drugi runner dostaje <c>null</c> i idzie spać — nie blokuje się
    /// na zajętym wierszu ani nie zabiera go pierwszemu.
    /// </summary>
    [Fact]
    public async Task Zajete_zadanie_jest_pomijane_a_nie_odbierane()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var schema = PostgresFixture.NewSchemaName("bulk");

        await using var instance = BulkTestInstance.Build(_postgres.ConnectionString, schema);
        await CreateSchemaAsync(instance, schema, cancellationToken);

        var jobUuid = await SeedJobAsync(instance, itemCount: 10, cancellationToken);

        using var scopeA = instance.CreateScope();
        using var scopeB = instance.CreateScope();

        var dbA = scopeA.ServiceProvider.GetRequiredService<BulkTestDbContext>();
        var dbB = scopeB.ServiceProvider.GetRequiredService<BulkTestDbContext>();

        await using var transactionA = await dbA.Database.BeginTransactionAsync(cancellationToken);
        await using var transactionB = await dbB.Database.BeginTransactionAsync(cancellationToken);

        (await scopeA.ServiceProvider.GetRequiredService<JobQueueLock<BulkTestDbContext>>()
            .TryLockNextAsync(dbA, JobKind.Map, cancellationToken)).ShouldBe(jobUuid);

        (await scopeB.ServiceProvider.GetRequiredService<JobQueueLock<BulkTestDbContext>>()
            .TryLockNextAsync(dbB, JobKind.Map, cancellationToken))
            .ShouldBeNull("Drugi runner dostał zadanie już zajęte przez pierwszego.");
    }

    // ── Pomocnicze ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Zakłada schemat i tabele dla jednego testu.
    ///
    /// <para><c>EnsureCreated</c> celowo nie jest tu użyte: sprawdza ono, czy <b>baza</b> ma
    /// jakiekolwiek tabele, i przy drugim teście w tym samym kontenerze nie tworzy już niczego —
    /// kolejny schemat zostawałby pusty, a błąd wychodziłby dopiero jako „relation does not exist"
    /// w losowym miejscu. <c>CreateTables</c> tworzy tabele bieżącego modelu bezwarunkowo.</para>
    /// </summary>
    private static async Task CreateSchemaAsync(
        ServiceProvider instance,
        string schema,
        CancellationToken cancellationToken)
    {
        using var scope = instance.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BulkTestDbContext>();

        // Nazwa schematu pochodzi z tego pliku, nie z wejścia — EF1002 nie ma tu zastosowania.
#pragma warning disable EF1002
        await db.Database.ExecuteSqlRawAsync($"CREATE SCHEMA IF NOT EXISTS \"{schema}\"", cancellationToken);
#pragma warning restore EF1002

        var creator = (RelationalDatabaseCreator)db.GetService<IDatabaseCreator>();
        await creator.CreateTablesAsync(cancellationToken);
    }

    private static async Task<Guid> SeedJobAsync(
        ServiceProvider instance,
        int itemCount,
        CancellationToken cancellationToken)
    {
        using var scope = instance.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BulkTestDbContext>();

        db.ChangeTracker.AutoDetectChangesEnabled = false;

        var targets = new List<JobTarget>(itemCount);

        for (var i = 0; i < itemCount; i++)
        {
            var counter = new TouchCounter(Guid.CreateVersion7());
            db.Counters.Add(counter);
            targets.Add(new JobTarget(counter.Uuid));
        }

        var job = Job.Create(
            TouchExecutor.Command,
            commandJson: null,
            targets,
            queueId: null,
            userId: "test",
            clientId: "test",
            correlationId: Guid.CreateVersion7(),
            uiMetadata: null,
            createdAt: DateTimeOffset.UtcNow);

        db.Jobs.Add(job);
        job.MarkAccepted();

        await db.SaveChangesAsync(cancellationToken);

        return job.Uuid;
    }

    /// <summary>
    /// Puszcza wszystkie instancje naraz i czeka, aż zadanie się domknie. Runnery startują
    /// w tej samej chwili celowo — rozjechany start zmniejszałby szansę na wyścig, czyli
    /// osłabiał dokładnie to, co test ma wykazać.
    /// </summary>
    private static async Task RunUntilFinishedAsync(
        IReadOnlyList<ServiceProvider> instances,
        Guid jobUuid,
        CancellationToken cancellationToken)
    {
        var runners = instances
            .Select(instance => new BulkCommandRunner<BulkTestDbContext>(
                instance.GetRequiredService<IServiceScopeFactory>(),
                instance.GetRequiredService<IOptions<BulkJobOptions>>(),
                instance.GetRequiredService<IJobQueueSignal>(),
                NullLogger<BulkCommandRunner<BulkTestDbContext>>.Instance))
            .ToList();

        foreach (var runner in runners)
        {
            await runner.StartAsync(cancellationToken);
        }

        try
        {
            var deadline = DateTimeOffset.UtcNow.AddMinutes(3);

            while (DateTimeOffset.UtcNow < deadline)
            {
                using var scope = instances[0].CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<BulkTestDbContext>();

                var status = await db.Jobs.AsNoTracking()
                    .Where(j => j.Uuid == jobUuid)
                    .Select(j => j.Status)
                    .FirstAsync(cancellationToken);

                if (status is JobStatus.Completed or JobStatus.Failed or JobStatus.Cancelled)
                {
                    return;
                }

                await Task.Delay(200, cancellationToken);
            }

            throw new TimeoutException($"Zadanie {jobUuid} nie domknęło się w wyznaczonym czasie.");
        }
        finally
        {
            foreach (var runner in runners)
            {
                await runner.StopAsync(CancellationToken.None);
            }
        }
    }
}
