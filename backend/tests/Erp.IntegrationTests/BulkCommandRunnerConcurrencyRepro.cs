using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Jobs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Npgsql;
using Shouldly;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// Executor testowy, który gwarantuje, że KAŻDA próba zapisu (główna i każda izolowana) wpadnie
/// w prawdziwy <c>DbUpdateConcurrencyException</c> — nie jednorazowy, tylko trwały konflikt, tak
/// jak w oryginalnym zgłoszeniu błędu (ta sama pozycja koliduje przy każdym ponowieniu).
///
/// <para>Symuluje to przez podbicie <c>xmin</c> licznika z ODDZIELNEGO połączenia tuż PRZED tym,
/// jak runner spróbuje zapisać swój (już nieaktualny) ślad zmian — więc "SaveChanges" zawsze
/// widzi 0 zaktualizowanych wierszy.</para>
/// </summary>
internal sealed class AlwaysConflictingExecutor : IBulkCommandExecutor
{
    public const string Command = "AlwaysConflictCommand";

    private readonly BulkTestDbContext _dbContext;
    private readonly string _connectionString;

    public AlwaysConflictingExecutor(BulkTestDbContext dbContext, AlwaysConflictingExecutorOptions options)
    {
        _dbContext = dbContext;
        _connectionString = options.ConnectionString;
    }

    public string CommandType => Command;

    public async Task ExecuteAsync(Guid aggregateUuid, string? commandJson, CancellationToken cancellationToken)
    {
        var counter = await _dbContext.Counters
            .FirstAsync(c => c.Uuid == aggregateUuid, cancellationToken)
            .ConfigureAwait(false);

        counter.Touch();

        // Podbij xmin z zupełnie innego połączenia, PO wczytaniu przez runnera, ale PRZED jego
        // SaveChanges — gwarantuje to konflikt przy KAŻDEJ próbie, nie tylko pierwszej.
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"UPDATE {_dbContext.Model.FindEntityType(typeof(TouchCounter))!.GetSchemaQualifiedTableName()} " +
            "SET \"touches\" = \"touches\" WHERE uuid = @uuid";
        cmd.Parameters.AddWithValue("uuid", aggregateUuid);
        await cmd.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }
}

internal sealed record AlwaysConflictingExecutorOptions(string ConnectionString);

/// <summary>
/// Wariant, który koliduje WYŁĄCZNIE dla wskazanych (z góry zatrutych) agregatów — reszta
/// zachowuje się jak zwykły <see cref="TouchExecutor"/>. Pozwala sprawdzić sukces częściowy
/// (część elementów przechodzi, jeden trwale konfliktuje) w JEDNYM zadaniu, bez deadlocka.
/// </summary>
internal sealed class PartiallyConflictingExecutor : IBulkCommandExecutor
{
    public const string Command = "PartialConflictCommand";

    private readonly BulkTestDbContext _dbContext;
    private readonly PartiallyConflictingExecutorOptions _options;

    public PartiallyConflictingExecutor(BulkTestDbContext dbContext, PartiallyConflictingExecutorOptions options)
    {
        _dbContext = dbContext;
        _options = options;
    }

    public string CommandType => Command;

    public async Task ExecuteAsync(Guid aggregateUuid, string? commandJson, CancellationToken cancellationToken)
    {
        var counter = await _dbContext.Counters
            .FirstAsync(c => c.Uuid == aggregateUuid, cancellationToken)
            .ConfigureAwait(false);

        counter.Touch();

        if (!_options.PoisonedUuids.Contains(aggregateUuid))
        {
            return;
        }

        await using var conn = new NpgsqlConnection(_options.ConnectionString);
        await conn.OpenAsync(cancellationToken).ConfigureAwait(false);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"UPDATE {_dbContext.Model.FindEntityType(typeof(TouchCounter))!.GetSchemaQualifiedTableName()} " +
            "SET \"touches\" = \"touches\" WHERE uuid = @uuid";
        cmd.Parameters.AddWithValue("uuid", aggregateUuid);
        await cmd.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }
}

internal sealed record PartiallyConflictingExecutorOptions(string ConnectionString, HashSet<Guid> PoisonedUuids);

/// <summary>
/// Repro dla zgłoszonego deadlocka: chunk z jednym elementem, który TRWALE koliduje przy zapisie
/// (nie jednorazowo). Przed poprawką <c>IsolateAsync</c> ta sytuacja więzła w nieskończoność —
/// <c>RecordIsolatedFailureAsync</c> próbuje zablokować TEN SAM wiersz <c>job</c>, który wciąż
/// trzyma otwarta (nie domknięta) transakcja bieżącej iteracji pętli izolacji.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class BulkCommandRunnerConcurrencyRepro
{
    private readonly PostgresFixture _postgres;

    public BulkCommandRunnerConcurrencyRepro(PostgresFixture postgres) => _postgres = postgres;

    [Fact]
    public async Task Single_item_chunk_with_persistent_concurrency_conflict_does_not_deadlock()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var schema = PostgresFixture.NewSchemaName("bulkdeadlock");

        await using var instance = BulkTestInstance.Build(_postgres.ConnectionString, schema, services =>
        {
            services.AddSingleton(new AlwaysConflictingExecutorOptions(_postgres.ConnectionString));
            services.AddKeyedScoped<IBulkCommandExecutor, AlwaysConflictingExecutor>(AlwaysConflictingExecutor.Command);
        });

        using (var scope = instance.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BulkTestDbContext>();
#pragma warning disable EF1002
            await db.Database.ExecuteSqlRawAsync($"CREATE SCHEMA IF NOT EXISTS \"{schema}\"", cancellationToken);
#pragma warning restore EF1002
            var creator = (RelationalDatabaseCreator)db.GetService<IDatabaseCreator>();
            await creator.CreateTablesAsync(cancellationToken);
        }

        Guid jobUuid;

        using (var scope = instance.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BulkTestDbContext>();

            var counter = new TouchCounter(Guid.CreateVersion7());
            db.Counters.Add(counter);

            var job = Job.Create(
                AlwaysConflictingExecutor.Command,
                commandJson: null,
                [new JobTarget(counter.Uuid)],
                queueId: null,
                userId: "test",
                clientId: "test",
                correlationId: Guid.CreateVersion7(),
                uiMetadata: null,
                createdAt: DateTimeOffset.UtcNow);

            db.Jobs.Add(job);
            job.MarkAccepted();

            await db.SaveChangesAsync(cancellationToken);
            jobUuid = job.Uuid;
        }

        var runner = new BulkCommandRunner<BulkTestDbContext>(
            instance.GetRequiredService<IServiceScopeFactory>(),
            instance.GetRequiredService<IOptions<BulkJobOptions>>(),
            instance.GetRequiredService<IJobQueueSignal>(),
            NullLogger<BulkCommandRunner<BulkTestDbContext>>.Instance);

        await runner.StartAsync(cancellationToken);

        try
        {
            // Element permanentnie koliduje, więc "sukces" tu nie oznacza Completed — oznacza,
            // że runner faktycznie ROBI POSTĘP (Attempts rośnie, aż element trafi w Failed) w
            // rozsądnym czasie, zamiast wisieć w nieskończoność na tej samej próbie.
            var deadline = DateTimeOffset.UtcNow.AddSeconds(45);
            JobStatus status = JobStatus.Pending;
            var maxAttemptsSeen = 0;

            while (DateTimeOffset.UtcNow < deadline)
            {
                using var scope = instance.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<BulkTestDbContext>();

                var job = await db.Jobs.AsNoTracking().FirstAsync(j => j.Uuid == jobUuid, cancellationToken);
                status = job.Status;

                var item = await db.JobItems.AsNoTracking().FirstAsync(i => i.JobUuid == jobUuid, cancellationToken);
                maxAttemptsSeen = Math.Max(maxAttemptsSeen, item.Attempts);

                if (status is JobStatus.Completed or JobStatus.CompletedWithErrors or JobStatus.Failed or JobStatus.Cancelled)
                {
                    break;
                }

                await Task.Delay(200, cancellationToken);
            }

            // Jedyny element trwale koliduje, więc po wyczerpaniu prób job kończy się jako
            // Failed (SucceededCount == 0) — liczy się to, że w ogóle DOSZEDŁ do stanu
            // końcowego w rozsądnym czasie, a nie utknął w izolacji w nieskończoność.
            status.ShouldBe(
                JobStatus.Failed,
                $"Runner utknął (deadlock w ścieżce izolacji) — Attempts osiągnęło tylko {maxAttemptsSeen}.");
        }
        finally
        {
            await runner.StopAsync(CancellationToken.None);
        }
    }

    /// <summary>
    /// Sukces częściowy musi przetrwać poprawkę: w chunku 10 elementów jeden trwale konfliktuje,
    /// dziewięć jest normalnych — zadanie ma domknąć się jako <c>CompletedWithErrors</c>, dziewięć
    /// liczników ma przyrost dokładnie 1 (nie 0 — pominięte, nie 2 — wykonane dwukrotnie), a cała
    /// operacja ma zmieścić się w rozsądnym czasie (żadnego deadlocka po drodze).
    /// </summary>
    [Fact]
    public async Task Multi_item_chunk_with_one_permanent_conflict_still_reports_partial_success()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        var schema = PostgresFixture.NewSchemaName("bulkpartial");

        const int itemCount = 10;
        var poisoned = new HashSet<Guid> { Guid.CreateVersion7() };

        await using var instance = BulkTestInstance.Build(_postgres.ConnectionString, schema, services =>
        {
            services.AddSingleton(new PartiallyConflictingExecutorOptions(_postgres.ConnectionString, poisoned));
            services.AddKeyedScoped<IBulkCommandExecutor, PartiallyConflictingExecutor>(PartiallyConflictingExecutor.Command);
        });

        using (var scope = instance.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BulkTestDbContext>();
#pragma warning disable EF1002
            await db.Database.ExecuteSqlRawAsync($"CREATE SCHEMA IF NOT EXISTS \"{schema}\"", cancellationToken);
#pragma warning restore EF1002
            var creator = (RelationalDatabaseCreator)db.GetService<IDatabaseCreator>();
            await creator.CreateTablesAsync(cancellationToken);
        }

        Guid jobUuid;
        var poisonedUuid = poisoned.Single();

        using (var scope = instance.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BulkTestDbContext>();

            var targets = new List<JobTarget> { new(poisonedUuid) };
            db.Counters.Add(new TouchCounter(poisonedUuid));

            for (var i = 1; i < itemCount; i++)
            {
                var counter = new TouchCounter(Guid.CreateVersion7());
                db.Counters.Add(counter);
                targets.Add(new JobTarget(counter.Uuid));
            }

            var job = Job.Create(
                PartiallyConflictingExecutor.Command,
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
            jobUuid = job.Uuid;
        }

        var runner = new BulkCommandRunner<BulkTestDbContext>(
            instance.GetRequiredService<IServiceScopeFactory>(),
            instance.GetRequiredService<IOptions<BulkJobOptions>>(),
            instance.GetRequiredService<IJobQueueSignal>(),
            NullLogger<BulkCommandRunner<BulkTestDbContext>>.Instance);

        await runner.StartAsync(cancellationToken);

        try
        {
            var deadline = DateTimeOffset.UtcNow.AddSeconds(45);
            JobStatus status = JobStatus.Pending;

            while (DateTimeOffset.UtcNow < deadline)
            {
                using var scope = instance.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<BulkTestDbContext>();

                status = await db.Jobs.AsNoTracking()
                    .Where(j => j.Uuid == jobUuid)
                    .Select(j => j.Status)
                    .FirstAsync(cancellationToken);

                if (status is JobStatus.Completed or JobStatus.CompletedWithErrors or JobStatus.Failed or JobStatus.Cancelled)
                {
                    break;
                }

                await Task.Delay(200, cancellationToken);
            }

            status.ShouldBe(JobStatus.CompletedWithErrors, "Zadanie nie doszło do stanu końcowego w rozsądnym czasie.");

            using var finalScope = instance.CreateScope();
            var finalDb = finalScope.ServiceProvider.GetRequiredService<BulkTestDbContext>();

            var job = await finalDb.Jobs.AsNoTracking().FirstAsync(j => j.Uuid == jobUuid, cancellationToken);
            job.SucceededCount.ShouldBe(itemCount - 1);
            job.FailedCount.ShouldBe(1);

            var poisonedItem = await finalDb.JobItems.AsNoTracking()
                .FirstAsync(i => i.JobUuid == jobUuid && i.AggregateUuid == poisonedUuid, cancellationToken);
            poisonedItem.Status.ShouldBe(JobItemStatus.Failed);
            poisonedItem.ErrorCode.ShouldBe("concurrency_conflict");

            var touchCounts = await finalDb.Counters.AsNoTracking()
                .Where(c => c.Uuid != poisonedUuid)
                .Select(c => c.Touches)
                .ToListAsync(cancellationToken);

            touchCounts.Count.ShouldBe(itemCount - 1);
            touchCounts.ShouldAllBe(t => t == 1, "Każdy zdrowy element ma się wykonać dokładnie raz.");
        }
        finally
        {
            await runner.StopAsync(CancellationToken.None);
        }
    }
}
