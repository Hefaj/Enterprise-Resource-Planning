using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace Erp.BuildingBlocks.Jobs;

/// <summary>
/// Wstawia elementy zadania masowego do bazy.
///
/// <para><b>Po co osobna abstrakcja zamiast zwykłego <c>AddRange</c>.</b> Elementy to
/// najliczniejsza rzecz, jaką zakładanie zadania zapisuje — przy 50 tys. celów EF generuje
/// ~50 wielowierszowych INSERT-ów i mieli je ~3,5 s, i to WEWNĄTRZ żądania HTTP, zanim klient
/// dostanie <c>jobUuid</c>. Binarne <c>COPY</c> Postgresa robi to samo w ~0,45 s. Ponieważ
/// wiersze są świeże, jednorodne i nikt ich w tym momencie nie modyfikuje, śledzenie zmian
/// przez EF nie wnosi tu nic poza kosztem.</para>
/// </summary>
public interface IJobItemBulkWriter
{
    /// <summary>
    /// Zapisuje elementy zadania. Wywoływane, gdy nagłówek zadania jest już w bazie
    /// (w stanie <c>JobStatus.Draft</c>), a przed przełączeniem go na
    /// <c>JobStatus.Pending</c>.
    /// </summary>
    Task WriteAsync(IReadOnlyCollection<JobItem> items, CancellationToken cancellationToken);
}

/// <summary>
/// Implementacja oparta o binarne <c>COPY</c> Postgresa.
///
/// <para><b>Nazwy tabeli i kolumn pochodzą z modelu EF</b>, a nie z literałów w kodzie —
/// inaczej zmiana mapowania (inny schemat modułu, przemianowana kolumna, konwencja nazw)
/// rozjechałaby się z tym plikiem po cichu, a błąd wyszedłby dopiero na produkcji. Zestaw
/// kolumn jest przy okazji sprawdzany: gdy model zawiera kolumnę, której ten writer nie zna
/// (bo ktoś dodał pole do <see cref="JobItem"/>), schodzimy na ścieżkę EF zamiast wstawiać
/// niekompletny wiersz. Wydajność jest wtedy gorsza — dane pozostają poprawne.</para>
/// </summary>
/// <typeparam name="TContext">Kontekst modułu z tabelami zadań.</typeparam>
public sealed partial class PostgresJobItemBulkWriter<TContext> : IJobItemBulkWriter
    where TContext : ErpDbContext, IJobDbContext
{
    /// <summary>Kolumny, dla których ten writer potrafi podać wartość — klucz to nazwa
    /// właściwości CLR, wartość to funkcja zapisująca ją do strumienia COPY.</summary>
    private static readonly Dictionary<string, Func<NpgsqlBinaryImporter, JobItem, CancellationToken, Task>> Writers =
        new(StringComparer.Ordinal)
        {
            [nameof(JobItem.Uuid)] = (w, i, ct) => w.WriteAsync(i.Uuid, NpgsqlDbType.Uuid, ct),
            [nameof(JobItem.JobUuid)] = (w, i, ct) => w.WriteAsync(i.JobUuid, NpgsqlDbType.Uuid, ct),
            [nameof(JobItem.AggregateUuid)] = (w, i, ct) => w.WriteAsync(i.AggregateUuid, NpgsqlDbType.Uuid, ct),
            [nameof(JobItem.Ordinal)] = (w, i, ct) => w.WriteAsync(i.Ordinal, NpgsqlDbType.Integer, ct),
            [nameof(JobItem.Status)] = (w, i, ct) => w.WriteAsync((int)i.Status, NpgsqlDbType.Integer, ct),
            [nameof(JobItem.Attempts)] = (w, i, ct) => w.WriteAsync(i.Attempts, NpgsqlDbType.Integer, ct),
            [nameof(JobItem.CommandJson)] = (w, i, ct) => WriteNullable(w, i.CommandJson, NpgsqlDbType.Jsonb, ct),
            [nameof(JobItem.ErrorCode)] = (w, i, ct) => WriteNullable(w, i.ErrorCode, NpgsqlDbType.Varchar, ct),
            [nameof(JobItem.ErrorMessage)] = (w, i, ct) => WriteNullable(w, i.ErrorMessage, NpgsqlDbType.Varchar, ct),
            [nameof(JobItem.ProcessedAt)] = (w, i, ct) => i.ProcessedAt is null
                ? w.WriteNullAsync(ct)
                : w.WriteAsync(i.ProcessedAt.Value, NpgsqlDbType.TimestampTz, ct),
        };

    private readonly TContext _dbContext;
    private readonly ILogger<PostgresJobItemBulkWriter<TContext>> _logger;

    public PostgresJobItemBulkWriter(TContext dbContext, ILogger<PostgresJobItemBulkWriter<TContext>> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task WriteAsync(IReadOnlyCollection<JobItem> items, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);

        if (items.Count == 0)
        {
            return;
        }

        if (!TryBuildCopyCommand(out var copyCommand, out var properties))
        {
            await WriteWithEntityFrameworkAsync(items, cancellationToken).ConfigureAwait(false);
            return;
        }

        // COPY musi iść po TYM SAMYM połączeniu co reszta zakładania zadania — inaczej
        // wiersze trafiłyby do bazy z innej sesji i (przy przyszłym objęciu tego transakcją)
        // nie widziałyby nagłówka zadania, do którego mają klucz obcy.
        var connection = (NpgsqlConnection)_dbContext.Database.GetDbConnection();

        var openedHere = connection.State != System.Data.ConnectionState.Open;
        if (openedHere)
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        }

        try
        {
            await using var writer = await connection
                .BeginBinaryImportAsync(copyCommand, cancellationToken)
                .ConfigureAwait(false);

            foreach (var item in items)
            {
                await writer.StartRowAsync(cancellationToken).ConfigureAwait(false);

                foreach (var property in properties)
                {
                    await Writers[property](writer, item, cancellationToken).ConfigureAwait(false);
                }
            }

            await writer.CompleteAsync(cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            if (openedHere)
            {
                await connection.CloseAsync().ConfigureAwait(false);
            }
        }
    }

    /// <summary>
    /// Składa polecenie <c>COPY</c> z modelu EF. Zwraca <c>false</c>, gdy model zawiera kolumnę
    /// spoza <see cref="Writers"/> — wtedy wołający musi zejść na ścieżkę EF.
    /// </summary>
    private bool TryBuildCopyCommand(out string copyCommand, out List<string> properties)
    {
        copyCommand = string.Empty;
        properties = [];

        var entityType = _dbContext.Model.FindEntityType(typeof(JobItem));
        var tableName = entityType?.GetTableName();

        if (entityType is null || tableName is null)
        {
            return false;
        }

        var storeObject = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier
            .Table(tableName, entityType.GetSchema());

        var columns = new List<string>();

        foreach (var property in entityType.GetProperties())
        {
            if (!Writers.ContainsKey(property.Name))
            {
                // Ktoś dodał pole do JobItem i nie dopisał go tutaj. Niekompletny wiersz byłby
                // gorszy od wolniejszego zapisu, więc oddajemy robotę EF-owi i głośno logujemy.
                LogUnknownColumn(_logger, property.Name);
                return false;
            }

            var columnName = property.GetColumnName(storeObject);
            if (columnName is null)
            {
                return false;
            }

            properties.Add(property.Name);
            columns.Add($"\"{columnName}\"");
        }

        if (columns.Count == 0)
        {
            return false;
        }

        var schema = entityType.GetSchema();
        var qualifiedTable = schema is null ? $"\"{tableName}\"" : $"\"{schema}\".\"{tableName}\"";

        copyCommand = $"COPY {qualifiedTable} ({string.Join(", ", columns)}) FROM STDIN (FORMAT BINARY)";
        return true;
    }

    /// <summary>Ścieżka awaryjna — poprawna, tylko wolniejsza.</summary>
    private async Task WriteWithEntityFrameworkAsync(
        IReadOnlyCollection<JobItem> items,
        CancellationToken cancellationToken)
    {
        var autoDetect = _dbContext.ChangeTracker.AutoDetectChangesEnabled;
        _dbContext.ChangeTracker.AutoDetectChangesEnabled = false;

        try
        {
            _dbContext.JobItems.AddRange(items);
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _dbContext.ChangeTracker.AutoDetectChangesEnabled = autoDetect;
        }
    }

    private static Task WriteNullable(
        NpgsqlBinaryImporter writer,
        string? value,
        NpgsqlDbType type,
        CancellationToken cancellationToken)
        => value is null
            ? writer.WriteNullAsync(cancellationToken)
            : writer.WriteAsync(value, type, cancellationToken);

    [LoggerMessage(EventId = 1, Level = LogLevel.Warning,
        Message = "JobItem ma kolumnę '{Property}', której PostgresJobItemBulkWriter nie zna — "
            + "elementy zadania zapisze EF Core (poprawnie, ale wolniej). Dopisz obsługę kolumny.")]
    private static partial void LogUnknownColumn(ILogger logger, string property);
}
