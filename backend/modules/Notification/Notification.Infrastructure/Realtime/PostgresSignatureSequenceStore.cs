using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.EntityFrameworkCore;
using Notification.Infrastructure.Persistence;
using Npgsql;
using NpgsqlTypes;

namespace Notification.Infrastructure.Realtime;

/// <summary>
/// Licznik sekwencji na atomowym <c>UPSERT</c> Postgresa.
///
/// <para><b>Dlaczego surowy SQL, a nie odczyt-modyfikacja-zapis przez EF.</b> Zwiększenie musi
/// być jedną operacją bazy. Wczytanie wiersza, dodanie jedynki i zapis to trzy kroki z oknem
/// pomiędzy — a licznik ma być poprawny nawet wtedy, gdy przekaźników przejściowo jest dwóch
/// (przełączenie roli, wariant z elekcją lidera). <c>INSERT … ON CONFLICT DO UPDATE …
/// RETURNING</c> daje inkrementację i odczyt nowej wartości w jednym poleceniu, pod blokadą
/// wiersza założoną przez samego Postgresa.</para>
/// </summary>
public sealed class PostgresSignatureSequenceStore : ISignatureSequenceStore
{
    private readonly NotificationDbContext _dbContext;

    public PostgresSignatureSequenceStore(NotificationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<long> NextAsync(string signature, CancellationToken cancellationToken)
    {
        var map = PostgresRowLock.Describe<SignatureSequence>(_dbContext);
        var signatureColumn = map.Column(nameof(SignatureSequence.Signature));
        var valueColumn = map.Column(nameof(SignatureSequence.Value));

        var sql =
            $"INSERT INTO {map.Table} ({signatureColumn}, {valueColumn}) VALUES (@signature, 1) "
            + $"ON CONFLICT ({signatureColumn}) DO UPDATE SET {valueColumn} = {map.Name}.{valueColumn} + 1 "
            + $"RETURNING {valueColumn}";

        return await ExecuteScalarLongAsync(sql, signature, cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<long> CurrentAsync(string signature, CancellationToken cancellationToken)
    {
        var map = PostgresRowLock.Describe<SignatureSequence>(_dbContext);

        var sql =
            $"SELECT {map.Column(nameof(SignatureSequence.Value))} FROM {map.Table} "
            + $"WHERE {map.Column(nameof(SignatureSequence.Signature))} = @signature";

        return await ExecuteScalarLongAsync(sql, signature, cancellationToken).ConfigureAwait(false);
    }

    private async Task<long> ExecuteScalarLongAsync(
        string sql,
        string signature,
        CancellationToken cancellationToken)
    {
        var connection = _dbContext.Database.GetDbConnection();

        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.Add(new NpgsqlParameter("signature", NpgsqlDbType.Text) { Value = signature });

        var result = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);

        // Brak wiersza znaczy „dla tej sygnatury nic jeszcze nie nadeszło" — zero, nie błąd.
        // Klient, który przyjdzie z lastSeenSequence różnym od zera, zobaczy wtedy lukę
        // i przeładuje dane, co jest właściwym zachowaniem po wyczyszczeniu tabeli.
        return result is long value ? value : 0;
    }
}
