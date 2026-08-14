using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Persistence;
using Wolverine.EntityFrameworkCore;

namespace Erp.BuildingBlocks.Messaging;

/// <summary>
/// Implementacja <see cref="IIntegrationEventPublisher"/> na outboxie Wolverine'a
/// zintegrowanym z EF Core.
///
/// <c>PublishAsync</c> nic nie wysyła — zapisuje kopertę komunikatu przez ten sam
/// <c>DbContext</c>, więc trafia ona do bazy dopiero razem z danymi, w jednej transakcji.
/// Dopiero <see cref="SaveChangesAndFlushAsync"/> zatwierdza całość i wypycha koperty
/// na brokera. Rollback transakcji zabiera ze sobą również komunikaty — nie da się
/// rozgłosić zmiany, która nie została zapisana.
///
/// Konsekwencja, o której trzeba pamiętać po stronie odbiorców: dostarczenie jest
/// <b>at-least-once</b>. Po awarii między zapisem a potwierdzeniem wysyłki ten sam komunikat
/// przyjdzie ponownie, więc każdy consumer musi być idempotentny.
/// </summary>
/// <typeparam name="TContext">Kontekst modułu, którego transakcja obejmuje outbox.</typeparam>
public sealed class WolverineIntegrationEventPublisher<TContext> : IIntegrationEventPublisher
    where TContext : ErpDbContext
{
    private readonly IDbContextOutbox<TContext> _outbox;

    public WolverineIntegrationEventPublisher(IDbContextOutbox<TContext> outbox)
    {
        _outbox = outbox;
    }

    /// <inheritdoc />
    public Task PublishAsync(object integrationEvent, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(integrationEvent);
        cancellationToken.ThrowIfCancellationRequested();

        // Routing Wolverine'a rozstrzyga po `message.GetType()`, nie po parametrze typowym —
        // dlatego przekazanie jako `object` jest bezpieczne i nie gubi typu komunikatu.
        return _outbox.PublishAsync(integrationEvent).AsTask();
    }

    /// <inheritdoc />
    public async Task PublishAllAsync(
        IEnumerable<object> integrationEvents,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(integrationEvents);

        foreach (var integrationEvent in integrationEvents)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await _outbox.PublishAsync(integrationEvent).ConfigureAwait(false);
        }
    }

    /// <inheritdoc />
    public Task SaveChangesAndFlushAsync(CancellationToken cancellationToken = default)
        // Wolverine zapisuje DbContext (dane + koperty w jednej transakcji), a po commicie
        // wypycha koperty do transportu.
        => _outbox.SaveChangesAndFlushMessagesAsync(cancellationToken);
}
