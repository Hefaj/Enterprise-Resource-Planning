using Catalog.Application.Abstractions;
using Catalog.Domain.ExportRuns;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Artifacts;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Jobs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Catalog.Infrastructure.Repositories;

/// <summary>Repozytorium przebiegów eksportu oparte na EF Core.</summary>
public sealed class ExportRunRepository : IExportRunRepository
{
    private readonly CatalogDbContext _dbContext;

    public ExportRunRepository(CatalogDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task AddAsync(ExportRun run, CancellationToken cancellationToken)
        => await _dbContext.ExportRuns.AddAsync(run, cancellationToken).ConfigureAwait(false);

    /// <inheritdoc />
    public async Task<ExportRun?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => await _dbContext.ExportRuns
            .FirstOrDefaultAsync(r => r.Uuid == uuid, cancellationToken)
            .ConfigureAwait(false);
}

/// <summary>
/// Zakłada zadanie <see cref="JobKind.Reduce"/> dla przebiegu eksportu.
///
/// <para>Prostsze niż <see cref="JobStore{TContext}"/>, bo nie ma elementów: nie ma czego wstawiać
/// binarnym <c>COPY</c>, więc nie ma też powodu rozbijać zakładania na trzy kroki. Nagłówek,
/// przyjęcie i koperta <see cref="JobAccepted"/> mieszczą się w jednej transakcji — o co
/// w tamtym rozbiciu i tak chodziło.</para>
/// </summary>
public sealed class ExportJobFactory : IExportJobFactory
{
    private readonly CatalogDbContext _dbContext;
    private readonly IIntegrationEventPublisher _publisher;
    private readonly IExecutionContext _executionContext;
    private readonly IClock _clock;

    /// <summary>
    /// Retencja pochodzi z tej samej opcji, którą inicjalizator kubełka wpisuje w regułę
    /// lifecycle MinIO — dzięki temu <c>job.expire_on</c> i wygasanie obiektu w magazynie
    /// nie mogą się rozjechać (patrz <c>docs/backend/exports-artifacts.md</c> §7).
    /// Konkretnie: z magazynu <c>transient</c>, bo to w nim żyją eksporty.
    /// </summary>
    private readonly ErpArtifactOptions _artifactOptions;

    public ExportJobFactory(
        CatalogDbContext dbContext,
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
    public async Task<(Guid JobUuid, DateTimeOffset? ExpireOn)> CreateForExportAsync(
        Guid exportRunUuid,
        string commandType,
        string? commandJson,
        CancellationToken cancellationToken)
    {
        var now = _clock.UtcNow;
        // Retencja magazynu WYGASAJĄCEGO — tam lądują eksporty. Sięgnięcie po magazyn trwały
        // dałoby przebieg, który nigdy nie wygasa, przy pliku kasowanym regułą lifecycle.
        var retentionDays = _artifactOptions.RequireStore(ArtifactStoreKeys.Transient).RetentionDays
            ?? throw new InvalidOperationException(
                "Magazyn `transient` nie ma ustawionego `RetentionDays`, a `job.expire_on` musi się "
                + "zgadzać z regułą wygasania kubełka (docs/backend/exports-artifacts.md §7).");

        var expireOn = now.AddDays(retentionDays);

        var job = Job.CreateReduce(
            commandType,
            commandJson,
            // queueId zostaje pusty: to identyfikator modalu, z którego poszła operacja, a nie
            // miejsce na uuid przebiegu. Odnośnik do wyniku jedzie osobnym polem (Job.ResultRef),
            // ustawianym dopiero, gdy artefakt faktycznie istnieje.
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
