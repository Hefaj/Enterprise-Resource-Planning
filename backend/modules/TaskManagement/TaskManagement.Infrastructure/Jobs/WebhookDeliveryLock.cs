using Erp.BuildingBlocks.Persistence.Concurrency;
using Npgsql;
using NpgsqlTypes;
using TaskManagement.Domain.Webhooks;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Jobs;

/// <summary>
/// Wyłączność dyspozytora na jednym dostarczeniu — <c>FOR UPDATE SKIP LOCKED</c> na wierszu
/// <c>webhook_delivery</c>, dokładnie ten sam wzorzec co <c>JobQueueLock</c>
/// (<c>Erp.BuildingBlocks.Jobs</c>), tyle że nie generyczny po module: Task Management jest
/// jedynym modułem z webhookami, więc generyczność nie miałaby czego uogólniać.
///
/// <para>Bez pomijania (<c>SKIP LOCKED</c>) N instancji dyspozytora zdegenerowałoby się do
/// jednej pracującej — z pomijaniem każda instancja bierze inne dostarczenie, więc N instancji
/// wysyła N webhooków naraz.</para>
/// </summary>
public sealed class WebhookDeliveryLock
{
    private readonly string _table;
    private readonly string _uuidColumn;
    private readonly string _statusColumn;
    private readonly string _nextAttemptAtColumn;

    public WebhookDeliveryLock(TaskManagementDbContext dbContext)
    {
        var map = PostgresRowLock.Describe<WebhookDelivery>(dbContext);

        _table = map.Table;
        _uuidColumn = map.Column(nameof(WebhookDelivery.Uuid));
        _statusColumn = map.Column(nameof(WebhookDelivery.Status));
        _nextAttemptAtColumn = map.Column(nameof(WebhookDelivery.NextAttemptAt));
    }

    /// <summary>Blokuje najstarsze dostarczenie oczekujące i już należne (<c>NextAttemptAt</c>
    /// w przeszłości) i zwraca jego <c>uuid</c>. <c>null</c> oznacza „nie ma nic do wysłania
    /// teraz" — dla dyspozytora to sygnał, żeby poczekać na kolejny tick.</summary>
    /// <remarks>Musi być wołane wewnątrz jawnej transakcji — patrz <c>PostgresRowLock</c>.</remarks>
    public async Task<Guid?> TryLockNextDueAsync(
        TaskManagementDbContext dbContext, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(dbContext);

        var sql =
            $"""
             SELECT {_uuidColumn}
               FROM {_table}
              WHERE {_statusColumn} = @status
                AND {_nextAttemptAtColumn} <= @now
              ORDER BY {_nextAttemptAtColumn}
                FOR UPDATE SKIP LOCKED
              LIMIT 1
             """;

        var parameters = new[]
        {
            new NpgsqlParameter("status", NpgsqlDbType.Varchar) { Value = nameof(WebhookDeliveryStatus.Pending) },
            new NpgsqlParameter("now", NpgsqlDbType.TimestampTz) { Value = now },
        };

        return await PostgresRowLock.LockUuidAsync(dbContext, sql, parameters, cancellationToken)
            .ConfigureAwait(false);
    }
}
