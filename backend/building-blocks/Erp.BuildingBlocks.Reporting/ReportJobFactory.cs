using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Artifacts;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Persistence;
using Microsoft.Extensions.Options;

namespace Erp.BuildingBlocks.Reporting;

/// <summary>
/// Implementacja <see cref="IReportJobFactory"/> wspólna dla wszystkich modułów — jedyna różnica
/// między nimi jest typ kontekstu, więc rozstrzyga ją parametr generyczny, dokładnie jak przy
/// <see cref="Jobs.BulkCommandRunner{TContext}"/>.
///
/// <para>Prostsze niż <see cref="JobStore{TContext}"/>, bo nie ma elementów: nagłówek, przyjęcie
/// i koperta <see cref="JobAccepted"/> mieszczą się w jednej transakcji.</para>
/// </summary>
/// <typeparam name="TContext">Kontekst modułu z tabelami <c>job</c>/<c>job_item</c>.</typeparam>
public sealed class ReportJobFactory<TContext> : IReportJobFactory
    where TContext : ErpDbContext, IJobDbContext
{
    private readonly TContext _dbContext;
    private readonly IIntegrationEventPublisher _publisher;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    /// <summary>
    /// Retencja pochodzi z tej samej opcji, którą inicjalizator kubełka wpisuje w regułę
    /// lifecycle MinIO — dzięki temu <c>job.expire_on</c> i wygasanie obiektu w magazynie nie
    /// mogą się rozjechać. Zawsze magazyn <c>transient</c> — tam żyją raporty i eksporty.
    /// </summary>
    private readonly ErpArtifactOptions _artifactOptions;

    public ReportJobFactory(
        TContext dbContext,
        IIntegrationEventPublisher publisher,
        IExecutionContext executionContext,
        IClock clock,
        IOptions<ErpArtifactOptions> artifactOptions)
    {
        ArgumentNullException.ThrowIfNull(artifactOptions);

        _dbContext = dbContext;
        _publisher = publisher;
        _executionContext = executionContext;
        _clock = clock;
        _artifactOptions = artifactOptions.Value;
    }

    /// <inheritdoc />
    public async Task<(Guid JobUuid, DateTimeOffset? ExpireOn)> CreateForReportAsync(
        Guid reportRunUuid,
        string commandType,
        string? commandJson,
        CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        var retentionDays = _artifactOptions.RequireStore(ArtifactStoreKeys.Transient).RetentionDays
            ?? throw new InvalidOperationException(
                "Magazyn `transient` nie ma ustawionego `RetentionDays`, a `job.expire_on` musi się "
                + "zgadzać z regułą wygasania kubełka (docs/backend/reporting.md §3).");

        var expireOn = now.AddDays(retentionDays);

        var job = Job.CreateReduce(
            commandType,
            commandJson,
            queueId: null,
            userId: _executionContext.UserId,
            clientId: _executionContext.ClientId,
            correlationId: _executionContext.CorrelationId,
            uiMetadata: null,
            createdAt: now,
            expireOn: expireOn);

        job.MarkAccepted();
        await _dbContext.Jobs.AddAsync(job, cancellationToken).ConfigureAwait(false);

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

        return (job.Uuid, expireOn);
    }
}
