using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Application.Commands;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Erp.BuildingBlocks.Persistence.Idempotency;

/// <summary>
/// Rejestr idempotencji na tabeli w schemacie modułu.
///
/// <para><b>Dlaczego w bazie, a nie w pamięci procesu.</b> Wpis w <c>IMemoryCache</c> nie
/// przeżywa restartu i nie istnieje dla drugiej instancji — czyli znika dokładnie w tych dwóch
/// sytuacjach, w których klient ponawia żądanie (serwis się przewrócił, load balancer przełożył
/// ruch). Ochrona, która wyłącza się w momencie, dla którego powstała, nie jest ochroną.
/// Tabela w schemacie modułu daje przy okazji to, czego pamięć dać nie może: klucz zatwierdza
/// się w JEDNEJ transakcji ze skutkiem komendy.</para>
/// </summary>
/// <typeparam name="TContext">Kontekst modułu, w którego schemacie leżą klucze.</typeparam>
public sealed class EfIdempotencyStore<TContext> : IIdempotencyStore
    where TContext : ErpDbContext
{
    private readonly TContext _dbContext;
    private readonly IClock _clock;
    private readonly CommandPipelineOptions _options;

    public EfIdempotencyStore(TContext dbContext, IClock clock, IOptions<CommandPipelineOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);

        _dbContext = dbContext;
        _clock = clock;
        _options = options.Value;
    }

    /// <inheritdoc />
    public async Task<IdempotentOperation?> FindAsync(string key, CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;

        // Wygasły wpis traktowany jak nieistniejący, zamiast czekać na sprzątacza: inaczej
        // skuteczność mechanizmu zależałaby od tego, kiedy ostatnio przebiegło czyszczenie.
        var record = await _dbContext.Set<IdempotencyRecord>()
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Key == key && r.ExpiresAt > now, cancellationToken)
            .ConfigureAwait(false);

        return record is null ? null : new IdempotentOperation(record.Key, record.Operation, record.ResultJson);
    }

    /// <inheritdoc />
    public void Stage(string key, string operation, string? userId, string? resultJson)
        => _dbContext.Add(IdempotencyRecord.Create(
            key,
            operation,
            userId,
            resultJson,
            _clock.UtcNow,
            _options.IdempotencyRetention));
}
