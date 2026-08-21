using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.BuildingBlocks.Jobs;

/// <summary>
/// Zakłada trwałe zadania masowe. Abstrakcja istnieje po to, żeby <c>BatchEndpointBase</c>
/// — który żyje w warstwie wspólnej i nie zna <c>DbContext</c> żadnego modułu — mógł mimo to
/// utrwalić zadanie w schemacie tego modułu, który je wykonuje.
/// </summary>
public interface IJobStore
{
    /// <summary>
    /// Tworzy zadanie wraz z elementami i publikuje <see cref="JobAccepted"/> — wszystko
    /// w jednej transakcji, więc nie może powstać zadanie, o którym reszta systemu nie wie.
    /// </summary>
    /// <param name="commandType">Nazwa typu komendy wykonywanej dla każdego elementu.</param>
    /// <param name="commandJson">Serializowana komenda-szablon, jeśli tryb jej używa.</param>
    /// <param name="targets">Elementy zadania.</param>
    /// <param name="queueId">Identyfikator wywołującego, po którym frontend grupuje zadania.</param>
    /// <param name="uiMetadata">Nieprzezroczysty dla backendu blob z frontendu.</param>
    /// <param name="preValidatedFailures">Elementy odrzucone przed utworzeniem zadania —
    /// patrz <see cref="Job.Create"/>. <c>null</c>, jeśli nie przeprowadzono pre-checku.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    /// <returns>Identyfikator zadania, zwracany klientowi jako <c>trackingID</c>.</returns>
    Task<Guid> CreateAsync(
        string commandType,
        string? commandJson,
        IReadOnlyList<JobTarget> targets,
        string? queueId,
        string? uiMetadata,
        IReadOnlyDictionary<Guid, (string ErrorCode, string ErrorMessage)>? preValidatedFailures,
        CancellationToken cancellationToken);
}

/// <summary>Implementacja oparta o kontekst modułu wykonującego zadanie.</summary>
/// <typeparam name="TContext">Kontekst z tabelami <c>job</c>/<c>job_item</c>.</typeparam>
public sealed class JobStore<TContext> : IJobStore
    where TContext : ErpDbContext, IJobDbContext
{
    private readonly TContext _dbContext;
    private readonly IIntegrationEventPublisher _publisher;
    private readonly IExecutionContext _executionContext;
    private readonly IJobItemBulkWriter _itemWriter;
    private readonly IClock _clock;

    public JobStore(
        TContext dbContext,
        IIntegrationEventPublisher publisher,
        IExecutionContext executionContext,
        IJobItemBulkWriter itemWriter,
        IClock clock)
    {
        _dbContext = dbContext;
        _publisher = publisher;
        _executionContext = executionContext;
        _itemWriter = itemWriter;
        _clock = clock;
    }

    /// <inheritdoc />
    public async Task<Guid> CreateAsync(
        string commandType,
        string? commandJson,
        IReadOnlyList<JobTarget> targets,
        string? queueId,
        string? uiMetadata,
        IReadOnlyDictionary<Guid, (string ErrorCode, string ErrorMessage)>? preValidatedFailures,
        CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;

        var job = Job.Create(
            commandType,
            commandJson,
            targets,
            queueId,
            _executionContext.UserId,
            _executionContext.ClientId,
            _executionContext.CorrelationId,
            uiMetadata,
            now,
            expireOn: null,
            preValidatedFailures: preValidatedFailures);

        // ── Krok 1: sam nagłówek, w stanie Draft ────────────────────────────────────────────
        //
        // `Entry(...).State = Added` zamiast `Jobs.Add(job)` jest tu istotne: `Add` przeszedłby
        // po grafie i wciągnął do ChangeTrackera wszystkie elementy, czyli dokładnie te wiersze,
        // które zaraz wstawi COPY. Przy 50 tys. celów oznaczałoby to podwójny zapis.
        _dbContext.Entry(job).State = EntityState.Added;
        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        // ── Krok 2: elementy przez binarne COPY ─────────────────────────────────────────────
        await _itemWriter.WriteAsync(job.Items, cancellationToken).ConfigureAwait(false);

        // ── Krok 3: przyjęcie zadania i koperta — ATOMOWO ───────────────────────────────────
        //
        // Dopiero to przełączenie czyni zadanie faktem: runner bierze wyłącznie Pending/Running,
        // więc do tej chwili szkic jest dla niego niewidzialny. Zapis idzie przez publisher,
        // żeby zmiana statusu i koperta zdarzenia trafiły do JEDNEJ transakcji — inaczej dałoby
        // się doprowadzić do zadania, które runner podejmie, a o którym Notification nigdy się
        // nie dowie (albo odwrotnie).
        //
        // Dlaczego nie wszystko w jednej transakcji: outbox Wolverine'a zapisuje kopertę dopiero
        // razem z jej wypchnięciem (`SaveChangesAndFlushMessagesAsync`), więc objęcie COPY tą
        // samą transakcją przesunęłoby wypchnięcie PRZED commit — a wtedy nieudany commit
        // zostawiłby Notification z zadaniem widmo. Rozbicie na dwa kroki zamienia ten scenariusz
        // na nieszkodliwy: awaria przed krokiem 3 zostawia szkic, którego nikt nie widzi
        // i nikt nie wykona.
        job.MarkAccepted();

        await _publisher.PublishAsync(
            new JobAccepted(
                job.Uuid,
                job.QueueId,
                job.CommandType,
                job.CommandJson,
                job.TotalCount,
                job.UserId,
                job.ClientId,
                job.UiMetadata,
                job.ExpireOn,
                now),
            cancellationToken).ConfigureAwait(false);

        await _publisher.SaveChangesAndFlushAsync(cancellationToken).ConfigureAwait(false);

        return job.Uuid;
    }
}
