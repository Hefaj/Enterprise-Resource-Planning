using System.Reflection;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using Microsoft.EntityFrameworkCore;

namespace Erp.BuildingBlocks.Persistence;

/// <summary>
/// Jednostka pracy modułu: zapis stanu i publikacja zdarzeń w JEDNEJ transakcji.
///
/// Kolejność kroków nie jest dowolna i wygląda tak:
/// <list type="number">
///   <item>Zebranie zdarzeń domenowych z agregatów — PRZED dispatchem, bo dispatch może
///     zmienić inne agregaty (i pośrednio wyczyścić/dopisać bufory), a zebranie musi widzieć
///     stan sprzed tego.</item>
///   <item>Dispatch zdarzeń domenowych do <see cref="IDomainEventListener{TEvent}"/> — reakcja
///     WEWNĄTRZ modułu, w tej samej transakcji (np. zamknięcie zgłoszenia przelicza stan
///     powiązanego zlecenia). Handler może doładować i zmutować inny agregat przez ten sam
///     <c>DbContext</c> — stąd dopiero PO tym kroku wolno odpalić skan ChangeTrackera.</item>
///   <item><c>DetectChanges</c> + skan ChangeTrackera → zdarzenia <c>AggregateChanged</c>
///     (co się zmieniło) — dopiero teraz, żeby objąć też mutacje zrobione przez dispatch.</item>
///   <item>Przetłumaczenie zdarzeń domenowych na integracyjne (co się wydarzyło biznesowo,
///     dla innych modułów) — <see cref="IDomainEventTranslator"/>.</item>
///   <item>Zakolejkowanie wszystkiego w outboxie i zapis — atomowo, przez publisher.</item>
///   <item>Wyczyszczenie buforów zdarzeń w agregatach, żeby ponowny zapis w tym samym
///     scope nie wysłał ich drugi raz.</item>
/// </list>
///
/// Dispatch zdarzeń domenowych jest celowo NIErekurencyjny: zdarzenia zebrane po dispatchu
/// (np. gdyby handler sam wywołał metodę raisującą kolejne zdarzenie) nie są dalej
/// dispatchowane w tym samym przebiegu — tylko wyczyszczone razem z resztą na końcu.
///
/// Zapis jest tu delegowany do <see cref="IIntegrationEventPublisher.SaveChangesAndFlushAsync"/>,
/// a nie wołany wprost na <c>DbContext</c>. To wygląda na inwersję, ale jest jedynym sposobem,
/// by wiersze outboxu trafiły do tej samej transakcji co dane — o co w całym wzorcu chodzi.
/// </summary>
/// <typeparam name="TContext">Kontekst modułu.</typeparam>
public sealed class ErpUnitOfWork<TContext> : IUnitOfWork
    where TContext : ErpDbContext
{
    private static readonly MethodInfo DispatchToHandlersMethod = typeof(ErpUnitOfWork<TContext>)
        .GetMethod(nameof(DispatchToHandlersAsync), BindingFlags.NonPublic | BindingFlags.Instance)!;

    private readonly TContext _dbContext;
    private readonly IIntegrationEventPublisher _publisher;
    private readonly IAggregateSignatureMap _signatureMap;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;
    private readonly IEnumerable<IDomainEventTranslator> _translators;
    private readonly IServiceProvider _serviceProvider;

    public ErpUnitOfWork(
        TContext dbContext,
        IIntegrationEventPublisher publisher,
        IAggregateSignatureMap signatureMap,
        IExecutionContext executionContext,
        IClock clock,
        IEnumerable<IDomainEventTranslator> translators,
        IServiceProvider serviceProvider)
    {
        _dbContext = dbContext;
        _publisher = publisher;
        _signatureMap = signatureMap;
        _executionContext = executionContext;
        _clock = clock;
        _translators = translators;
        _serviceProvider = serviceProvider;
    }

    /// <inheritdoc />
    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var roots = CollectAggregatesWithEvents();
        var domainEvents = roots.SelectMany(root => root.DomainEvents).ToList();

        foreach (var domainEvent in domainEvents)
        {
            var dispatch = (Task)DispatchToHandlersMethod
                .MakeGenericMethod(domainEvent.GetType())
                .Invoke(this, [domainEvent, cancellationToken])!;
            await dispatch.ConfigureAwait(false);
        }

        _dbContext.ChangeTracker.DetectChanges();

        var now = _clock.UtcNow;

        var aggregateChanges = AggregateChangeScanner.Scan(
            _dbContext.ChangeTracker,
            _signatureMap,
            _executionContext.CorrelationId,
            now);

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

        foreach (var root in CollectAggregatesWithEvents())
        {
            root.ClearDomainEvents();
        }
    }

    /// <summary>
    /// Rozwiązuje <see cref="IDomainEventListener{TEvent}"/> zarejestrowane dla konkretnego typu
    /// zdarzenia i wywołuje je po kolei. Wywoływane przez reflection z <see cref="SaveChangesAsync"/>,
    /// bo typ zdarzenia jest znany dopiero w runtime (<c>domainEvent.GetType()</c>) — generyk
    /// trzeba domknąć dynamicznie, żeby DI odnalazło właściwy zamknięty <c>IEnumerable&lt;...&gt;</c>.
    /// </summary>
    private async Task DispatchToHandlersAsync<TEvent>(TEvent domainEvent, CancellationToken cancellationToken)
        where TEvent : IDomainEvent
    {
        var handlers = _serviceProvider.GetService(typeof(IEnumerable<IDomainEventListener<TEvent>>))
            as IEnumerable<IDomainEventListener<TEvent>>;

        if (handlers is null)
        {
            return;
        }

        foreach (var handler in handlers)
        {
            await handler.HandleAsync(domainEvent, cancellationToken).ConfigureAwait(false);
        }
    }

    private List<AggregateRoot> CollectAggregatesWithEvents()
        => [.. _dbContext.ChangeTracker
            .Entries<AggregateRoot>()
            .Select(entry => entry.Entity)
            .Where(root => root.DomainEvents.Count > 0)];
}
