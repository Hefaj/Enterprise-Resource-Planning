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
    private readonly IClock _clock;

    public JobStore(
        TContext dbContext,
        IIntegrationEventPublisher publisher,
        IExecutionContext executionContext,
        IClock clock)
    {
        _dbContext = dbContext;
        _publisher = publisher;
        _executionContext = executionContext;
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

        _dbContext.Jobs.Add(job);

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

        // Zapis idzie przez publisher, żeby wiersze zadania i koperta zdarzenia trafiły
        // do JEDNEJ transakcji. Gdyby to rozdzielić, dałoby się doprowadzić do zadania
        // istniejącego w bazie, o którym Notification nigdy się nie dowie (albo odwrotnie).
        await _publisher.SaveChangesAndFlushAsync(cancellationToken).ConfigureAwait(false);

        return job.Uuid;
    }
}
