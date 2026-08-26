using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace Erp.BuildingBlocks.Persistence.Concurrency;

/// <summary>
/// Wspólna mechanika blokowania wiersza kolejki przez <c>FOR UPDATE [SKIP LOCKED]</c>.
///
/// <para><b>Dlaczego surowy SQL, a nie EF.</b> EF Core nie ma <c>FOR UPDATE</c> w LINQ, a
/// <c>FromSql</c> nie nadaje się tu z dwóch niezależnych powodów. Po pierwsze, agregaty mają
/// token współbieżności na systemowej kolumnie <c>xmin</c>, której <c>SELECT *</c> nie zwraca —
/// materializacja encji z surowego zapytania od razu by się wywaliła. Po drugie, na wyniku
/// <c>FromSql</c> nie wolno komponować LINQ (<c>.Where()</c>, <c>.OrderBy()</c>): EF opakowuje
/// wtedy zapytanie w podzapytanie, a <c>FOR UPDATE</c> w podzapytaniu nie robi tego, co się
/// wydaje. Blokujemy więc surowym SQL-em zwracającym sam identyfikator, a wiersz wczytujemy
/// normalnym zapytaniem EF — w tej samej transakcji, więc na wierszu, którego nikt inny
/// już nie ruszy.</para>
///
/// <para><b>Nazwy tabel i kolumn pochodzą z modelu EF</b>, nie z literałów. Runnery są generyczne
/// po module, więc schemat (<c>catalog</c>, <c>sales</c>, …) nie może być wpisany na sztywno —
/// a przy okazji zmiana mapowania nie rozjeżdża się po cichu z surowym SQL-em. Ten sam zabieg
/// robi <c>PostgresJobItemBulkWriter</c> przy składaniu <c>COPY</c>.</para>
/// </summary>
public static class PostgresRowLock
{
    /// <summary>Nazwy tabeli i kolumn encji, gotowe do wstawienia w surowy SQL (już cytowane).</summary>
    public sealed class TableMap
    {
        private readonly IEntityType _entityType;
        private readonly StoreObjectIdentifier _storeObject;

        internal TableMap(IEntityType entityType, StoreObjectIdentifier storeObject, string table, string name)
        {
            _entityType = entityType;
            _storeObject = storeObject;
            Table = table;
            Name = name;
        }

        /// <summary>Nazwa tabeli z kwalifikacją schematem, w cudzysłowach.</summary>
        public string Table { get; }

        /// <summary>Sama nazwa tabeli, bez schematu, w cudzysłowach.</summary>
        /// <remarks>Potrzebna tam, gdzie SQL odwołuje się do tabeli jako do <b>aliasu</b>,
        /// a nie do obiektu — klauzula <c>ON CONFLICT DO UPDATE SET</c> nie przyjmuje
        /// kwalifikacji schematem.</remarks>
        public string Name { get; }

        /// <summary>Nazwa kolumny odpowiadającej właściwości CLR, w cudzysłowach.</summary>
        /// <exception cref="InvalidOperationException">Gdy właściwość nie jest zmapowana —
        /// czyli gdy surowy SQL rozjechał się z modelem.</exception>
        public string Column(string propertyName)
        {
            var property = _entityType.FindProperty(propertyName)
                ?? throw new InvalidOperationException(
                    $"{_entityType.ClrType.Name} nie mapuje właściwości '{propertyName}'.");

            var columnName = property.GetColumnName(_storeObject)
                ?? throw new InvalidOperationException(
                    $"Właściwość '{propertyName}' nie ma kolumny w modelu.");

            return Quote(columnName);
        }
    }

    /// <summary>Odczytuje mapowanie encji z modelu kontekstu.</summary>
    public static TableMap Describe<TEntity>(DbContext dbContext)
        where TEntity : class
    {
        ArgumentNullException.ThrowIfNull(dbContext);

        var entityType = dbContext.Model.FindEntityType(typeof(TEntity))
            ?? throw new InvalidOperationException(
                $"Kontekst {dbContext.GetType().Name} nie mapuje {typeof(TEntity).Name}.");

        var tableName = entityType.GetTableName()
            ?? throw new InvalidOperationException($"{typeof(TEntity).Name} nie ma nazwy tabeli w modelu.");

        var schema = entityType.GetSchema();
        var storeObject = StoreObjectIdentifier.Table(tableName, schema);
        var table = schema is null ? Quote(tableName) : $"{Quote(schema)}.{Quote(tableName)}";

        return new TableMap(entityType, storeObject, table, Quote(tableName));
    }

    /// <summary>
    /// Wykonuje zapytanie blokujące po połączeniu <b>tego</b> kontekstu, żeby trafiło do jego
    /// bieżącej transakcji, i zwraca zablokowany identyfikator.
    ///
    /// <para><c>ExecuteScalar</c>, a nie <c>SqlQueryRaw</c>: to drugie wymagałoby aliasu kolumny
    /// na <c>Value</c> i przechodziło przez cały potok materializacji EF po to, żeby oddać
    /// jeden identyfikator.</para>
    /// </summary>
    /// <returns><c>null</c>, gdy nie ma czego zablokować (brak wiersza albo — przy
    /// <c>SKIP LOCKED</c> — wszystkie kandydatury zajęte przez inne instancje).</returns>
    public static async Task<Guid?> LockUuidAsync(
        DbContext dbContext,
        string sql,
        IReadOnlyCollection<NpgsqlParameter> parameters,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(parameters);

        var connection = dbContext.Database.GetDbConnection();

        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Transaction = dbContext.Database.CurrentTransaction?.GetDbTransaction();

        foreach (var parameter in parameters)
        {
            command.Parameters.Add(parameter);
        }

        var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);

        return result is Guid uuid ? uuid : null;
    }

    private static string Quote(string identifier) => $"\"{identifier}\"";
}
