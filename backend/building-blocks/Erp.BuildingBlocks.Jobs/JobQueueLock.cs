using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Npgsql;
using NpgsqlTypes;

namespace Erp.BuildingBlocks.Jobs;

/// <summary>
/// Wyłączność runnera na zadaniu — <c>FOR UPDATE SKIP LOCKED</c> na wierszu <c>job</c>.
///
/// <para><b>Co to rozwiązuje.</b> Dwa runnery (dwie instancje serwisu) wybierające „najstarsze
/// niezakończone zadanie" bez żadnej wyłączności dostają to samo zadanie i te same elementy.
/// Blokada wiersza zadania sprawia, że <b>jedno zadanie obsługuje dokładnie jeden runner</b>.</para>
///
/// <para><b>Dlaczego <c>SKIP LOCKED</c>, a nie samo <c>FOR UPDATE</c>.</b> Bez pomijania wszystkie
/// runnery ustawiłyby się w kolejce do tego samego, najstarszego zadania i flota zdegenerowałaby
/// się do jednego pracującego procesu. Z pomijaniem runner B bierze następne zadanie:
/// <b>N runnerów pracuje nad N zadaniami</b>.</para>
///
/// <para><b>Dlaczego blokujemy zadanie, a nie elementy.</b> Blokada elementów dałaby
/// współbieżność wewnątrz jednego zadania, ale dwa runnery aktualizowałyby wtedy liczniki tego
/// samego wiersza <c>job</c> — <c>xmin</c> wyłapywałby konflikt na <c>SaveChanges</c>, chunk
/// wpadałby w ścieżkę izolacji „element po elemencie", a przepustowość leciałaby na łeb. Ta
/// współbieżność jest świadomie odpuszczona; wraca do rozważenia dopiero, gdy pojedyncze wielkie
/// zadanie okaże się wąskim gardłem (patrz <c>docs/architecture/multi-instance.md</c> §4.1).</para>
///
/// <para><b>Dlaczego lock zwraca sam <c>uuid</c>, a nie encję</b> — patrz
/// <see cref="PostgresRowLock"/>, gdzie mieszka wspólna mechanika i jej uzasadnienie.</para>
///
/// <para><b>Zwolnienie</b> następuje przy <c>COMMIT</c> transakcji chunka, a przy awarii procesu
/// — razem z zerwaną sesją. Nie ma osieroconych dzierżaw ani reguły ich odzysku.</para>
/// </summary>
/// <typeparam name="TContext">Kontekst modułu z tabelami zadań.</typeparam>
public sealed class JobQueueLock<TContext>
    where TContext : ErpDbContext, IJobDbContext
{
    private readonly string _table;
    private readonly string _uuidColumn;
    private readonly string _kindColumn;
    private readonly string _statusColumn;
    private readonly string _createdAtColumn;

    /// <summary>Odczytuje nazwy tabeli i kolumn z modelu EF tego kontekstu.</summary>
    public JobQueueLock(TContext dbContext)
    {
        var map = PostgresRowLock.Describe<Job>(dbContext);

        _table = map.Table;
        _uuidColumn = map.Column(nameof(Job.Uuid));
        _kindColumn = map.Column(nameof(Job.Kind));
        _statusColumn = map.Column(nameof(Job.Status));
        _createdAtColumn = map.Column(nameof(Job.CreatedAt));
    }

    /// <summary>
    /// Blokuje najstarsze niezakończone zadanie danego rodzaju i zwraca jego <c>uuid</c>.
    /// <c>null</c> oznacza „nie ma pracy albo całą zajęły inne runnery" — dla wołającego to ta
    /// sama sytuacja: poczekaj i spróbuj ponownie.
    /// </summary>
    /// <remarks>Musi być wołane <b>wewnątrz jawnej transakcji</b> — blokada wiersza żyje tylko
    /// do jej zakończenia. Poza transakcją Postgres zwolniłby ją natychmiast po zapytaniu,
    /// a wyłączność byłaby pozorna.</remarks>
    public async Task<Guid?> TryLockNextAsync(TContext dbContext, JobKind kind, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(dbContext);

        // Filtr po Kind jest konieczny, nie kosmetyczny: przebieg reduce (eksport) nie ma
        // żadnego `job_item`, więc runner komend podjąłby go, nie znalazł pracy i uznał
        // zadanie za puste — a właściwy runner nigdy by go nie zobaczył.
        var sql =
            $"""
             SELECT {_uuidColumn}
               FROM {_table}
              WHERE {_kindColumn} = @kind
                AND {_statusColumn} = ANY(@statuses)
              ORDER BY {_createdAtColumn}
                FOR UPDATE SKIP LOCKED
              LIMIT 1
             """;

        var parameters = new[]
        {
            new NpgsqlParameter("kind", NpgsqlDbType.Integer) { Value = (int)kind },
            new NpgsqlParameter("statuses", NpgsqlDbType.Array | NpgsqlDbType.Integer)
            {
                Value = new[] { (int)JobStatus.Pending, (int)JobStatus.Running },
            },
        };

        return await PostgresRowLock.LockUuidAsync(dbContext, sql, parameters, cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>
    /// Blokuje <b>wskazane</b> zadanie — bez pomijania, więc czeka, aż zwolni je inny runner.
    ///
    /// <para>Używane w trybie izolacji: chunk padł przy zapisie, transakcja (a z nią blokada)
    /// poszła do rollbacku, a elementy trzeba powtórzyć pojedynczo. Pomijanie byłoby tu błędem —
    /// chodzi o TO zadanie, nie o „jakieś wolne".</para>
    /// </summary>
    /// <returns><c>null</c>, gdy zadania już nie ma (skasowane w międzyczasie).</returns>
    public async Task<Guid?> LockAsync(TContext dbContext, Guid jobUuid, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(dbContext);

        var sql = $"SELECT {_uuidColumn} FROM {_table} WHERE {_uuidColumn} = @uuid FOR UPDATE";
        var parameters = new[] { new NpgsqlParameter("uuid", NpgsqlDbType.Uuid) { Value = jobUuid } };

        return await PostgresRowLock.LockUuidAsync(dbContext, sql, parameters, cancellationToken)
            .ConfigureAwait(false);
    }
}
