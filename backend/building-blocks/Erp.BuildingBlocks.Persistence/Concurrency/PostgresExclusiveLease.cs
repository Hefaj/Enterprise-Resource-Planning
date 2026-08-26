using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace Erp.BuildingBlocks.Persistence.Concurrency;

/// <summary>
/// Dzierżawa na <b>sesyjnym</b> advisory locku Postgresa.
///
/// <para><b>Dlaczego osobne połączenie, a nie to od <c>DbContext</c>.</b> Advisory lock sesyjny
/// żyje tak długo, jak sesja, która go wzięła. Połączenie <c>DbContext</c> wraca do puli między
/// zapytaniami, a wraz z nim (przez <c>DISCARD ALL</c>) zniknąłby lock — dzierżawa puszczałaby
/// w losowym momencie, bez żadnego objawu poza dwiema instancjami robiącymi to samo. Stąd
/// połączenie otwierane wprost z łańcucha i trzymane przez cały czas dzierżawy.</para>
///
/// <para><b>Zwolnienie jest dwutorowe i to jest cały sens tego mechanizmu.</b> Ścieżka normalna
/// to <c>pg_advisory_unlock</c> przy <c>DisposeAsync</c>. Ścieżka awaryjna nie wymaga niczyjego
/// działania: gdy proces ginie, ginie z nim gniazdo TCP, a Postgres zwalnia lock sam. Nie ma
/// więc osieroconych dzierżaw ani procedury ich odzysku.</para>
/// </summary>
/// <typeparam name="TContext">Kontekst modułu — dostarcza łańcuch połączenia. Sam kontekst nie
/// jest do niczego innego używany; dzierżawa nie dotyka żadnej tabeli.</typeparam>
public sealed partial class PostgresExclusiveLease<TContext> : IExclusiveLease
    where TContext : ErpDbContext
{
    private readonly string _connectionString;
    private readonly ILogger<PostgresExclusiveLease<TContext>> _logger;

    public PostgresExclusiveLease(TContext dbContext, ILogger<PostgresExclusiveLease<TContext>> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);

        _connectionString = dbContext.Database.GetConnectionString()
            ?? throw new InvalidOperationException(
                $"Kontekst {typeof(TContext).Name} nie ma łańcucha połączenia — dzierżawa wyłączności "
                + "nie ma jak otworzyć własnej sesji Postgresa.");

        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<IAsyncDisposable?> TryAcquireAsync(string resource, CancellationToken cancellationToken)
    {
        var connection = await OpenAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            await using var command = new NpgsqlCommand(
                "SELECT pg_try_advisory_lock(hashtext(@resource)::bigint)",
                connection);
            command.Parameters.Add(new NpgsqlParameter("resource", NpgsqlDbType.Text) { Value = resource });

            var acquired = await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false) as bool?;

            if (acquired != true)
            {
                LogBusy(_logger, resource);
                await connection.DisposeAsync().ConfigureAwait(false);
                return null;
            }

            LogAcquired(_logger, resource);
            return new Lease(connection, resource, _logger);
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    /// <inheritdoc />
    public async Task<IAsyncDisposable> AcquireAsync(string resource, CancellationToken cancellationToken)
    {
        var connection = await OpenAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            // Czekanie dzieje się PO STRONIE BAZY, nie w pętli odpytującej. Anulowanie tokenu
            // wysyła Postgresowi żądanie przerwania zapytania, więc zatrzymanie hosta w trakcie
            // oczekiwania nie zawiesza zamykania procesu.
            await using var command = new NpgsqlCommand(
                "SELECT pg_advisory_lock(hashtext(@resource)::bigint)",
                connection);
            command.Parameters.Add(new NpgsqlParameter("resource", NpgsqlDbType.Text) { Value = resource });

            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);

            LogAcquired(_logger, resource);
            return new Lease(connection, resource, _logger);
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    /// <summary>
    /// Otwiera sesję dzierżawy z <b>wyłączoną pulą</b>.
    ///
    /// <para>Połączenie z puli nie jest „własne": po <c>Dispose</c> wraca do niej i może zostać
    /// wydane komuś innemu, a przy zamykaniu aplikacji pula bywa opróżniana niezależnie od tego,
    /// czy dzierżawa jeszcze trwa. Dzierżaw jest w procesie kilka (usługi cykliczne, start),
    /// więc jedno dodatkowe połączenie na każdą jest kosztem bez znaczenia — w zamian sesja
    /// zaczyna się i kończy dokładnie razem z dzierżawą.</para>
    /// </summary>
    private async Task<NpgsqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var builder = new NpgsqlConnectionStringBuilder(_connectionString)
        {
            Pooling = false,
            ApplicationName = "erp-exclusive-lease",
        };

        var connection = new NpgsqlConnection(builder.ConnectionString);

        try
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Debug, Message = "Wzięto wyłączność na '{Resource}'.")]
    private static partial void LogAcquired(ILogger logger, string resource);

    [LoggerMessage(EventId = 2, Level = LogLevel.Debug,
        Message = "Wyłączność na '{Resource}' trzyma inna instancja — przebieg pominięty.")]
    private static partial void LogBusy(ILogger logger, string resource);

    [LoggerMessage(EventId = 3, Level = LogLevel.Warning,
        Message = "Nie udało się zwolnić wyłączności na '{Resource}'; puści ją zamknięcie sesji.")]
    private static partial void LogReleaseFailed(ILogger logger, string resource, Exception exception);

    /// <summary>Token dzierżawy: zwalnia lock i zamyka sesję.</summary>
    private sealed class Lease : IAsyncDisposable
    {
        private readonly NpgsqlConnection _connection;
        private readonly string _resource;
        private readonly ILogger _logger;
        private bool _disposed;

        internal Lease(NpgsqlConnection connection, string resource, ILogger logger)
        {
            _connection = connection;
            _resource = resource;
            _logger = logger;
        }

        public async ValueTask DisposeAsync()
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;

            try
            {
                await using var command = new NpgsqlCommand(
                    "SELECT pg_advisory_unlock(hashtext(@resource)::bigint)",
                    _connection);
                command.Parameters.Add(new NpgsqlParameter("resource", NpgsqlDbType.Text) { Value = _resource });

                // Bez tokenu anulowania: zwolnienie idzie zwykle przy zatrzymywaniu hosta, kiedy
                // token jest już anulowany. Zamknięcie sesji niżej i tak puściłoby lock, ale
                // jawny unlock zostawia czytelniejszy ślad w `pg_locks`.
                await command.ExecuteNonQueryAsync().ConfigureAwait(false);
            }
#pragma warning disable CA1031 // Zwolnienie dzierżawy nie może wywrócić zamykania hosta.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                LogReleaseFailed(_logger, _resource, ex);
            }
            finally
            {
                await _connection.DisposeAsync().ConfigureAwait(false);
            }
        }
    }
}
