using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using Microsoft.EntityFrameworkCore;

namespace Erp.BuildingBlocks.Persistence;

/// <summary>
/// Jednostka pracy modułu: zapis stanu i publikacja zdarzeń w JEDNEJ transakcji.
///
/// Kolejność kroków nie jest dowolna i wygląda tak:
/// <list type="number">
///   <item><c>DetectChanges</c> — musi wykonać się PRZED skanem, inaczej zmiany zrobione
///     na encjach POCO nie są jeszcze widoczne w ChangeTrackerze i skan zwróciłby pustkę.</item>
///   <item>Skan ChangeTrackera → zdarzenia <c>AggregateChanged</c> (co się zmieniło).</item>
///   <item>Zebranie zdarzeń domenowych z agregatów i przetłumaczenie ich na integracyjne
///     (co się wydarzyło biznesowo). Zebranie też musi być przed zapisem, bo po nim
///     usunięte agregaty są już odpięte od kontekstu.</item>
///   <item>Zakolejkowanie wszystkiego w outboxie i zapis — atomowo, przez publisher.</item>
///   <item>Wyczyszczenie buforów zdarzeń w agregatach, żeby ponowny zapis w tym samym
///     scope nie wysłał ich drugi raz.</item>
/// </list>
///
/// Zapis jest tu delegowany do <see cref="IIntegrationEventPublisher.SaveChangesAndFlushAsync"/>,
/// a nie wołany wprost na <c>DbContext</c>. To wygląda na inwersję, ale jest jedynym sposobem,
/// by wiersze outboxu trafiły do tej samej transakcji co dane — o co w całym wzorcu chodzi.
/// </summary>
/// <typeparam name="TContext">Kontekst modułu.</typeparam>
public sealed class ErpUnitOfWork<TContext> : IUnitOfWork
    where TContext : ErpDbContext
{
    private readonly TContext _dbContext;
    private readonly IIntegrationEventPublisher _publisher;
    private readonly IAggregateSignatureMap _signatureMap;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;
    private readonly IEnumerable<IDomainEventTranslator> _translators;

    public ErpUnitOfWork(
        TContext dbContext,
        IIntegrationEventPublisher publisher,
        IAggregateSignatureMap signatureMap,
        IExecutionContext executionContext,
        IClock clock,
        IEnumerable<IDomainEventTranslator> translators)
    {
        _dbContext = dbContext;
        _publisher = publisher;
        _signatureMap = signatureMap;
        _executionContext = executionContext;
        _clock = clock;
        _translators = translators;
    }

    /// <inheritdoc />
    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        _dbContext.ChangeTracker.DetectChanges();

        var now = _clock.UtcNow;

        var aggregateChanges = AggregateChangeScanner.Scan(
            _dbContext.ChangeTracker,
            _signatureMap,
            _executionContext.CorrelationId,
            now);

        var roots = CollectAggregatesWithEvents();
        var domainEvents = roots.SelectMany(root => root.DomainEvents).ToList();

        var integrationEvents = new List<object>(aggregateChanges);
        foreach (var domainEvent in domainEvents)
        {
            foreach (var translator in _translators)
            {
                integrationEvents.AddRange(translator.Translate(domainEvent, _executionContext));
            }
        }

        if (integrationEvents.Count > 0)
        {
            await _publisher.PublishAllAsync(integrationEvents, cancellationToken).ConfigureAwait(false);
        }

        await _publisher.SaveChangesAndFlushAsync(cancellationToken).ConfigureAwait(false);

        foreach (var root in roots)
        {
            root.ClearDomainEvents();
        }
    }

    private List<AggregateRoot> CollectAggregatesWithEvents()
        => [.. _dbContext.ChangeTracker
            .Entries<AggregateRoot>()
            .Select(entry => entry.Entity)
            .Where(root => root.DomainEvents.Count > 0)];
}
