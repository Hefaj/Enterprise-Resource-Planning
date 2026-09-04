using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;
using Erp.BuildingBlocks.Jobs;
using Erp.BuildingBlocks.Persistence;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace Erp.BuildingBlocks.Reporting;

/// <summary>
/// Wykonuje przebiegi raportów — jeden silnik dla WSZYSTKICH definicji wszystkich modułów,
/// zarejestrowany raz na moduł z jego własnym <typeparamref name="TContext"/> (patrz
/// <c>docs/architecture/reporting.md</c> §2-4). Uogólnienie dzisiejszego
/// <c>Catalog.Infrastructure.Jobs.ExportRunner</c> — eksport staje się jedną z definicji
/// (<c>catalog.product-export</c>), nie osobnym runnerem.
///
/// <para>Zachowanie jest identyczne z tym, co robił <c>ExportRunner</c>:</para>
/// <list type="number">
///   <item><b>Strumieniuje, nie materializuje.</b> Źródłem jest <see cref="IReportDefinition.StreamAsync"/>,
///     wyjściem strumień do magazynu artefaktów przez <see cref="ReportFormatWriter"/>.</item>
///   <item><b>Postęp zapisuje co <see cref="ProgressBatchSize"/> rekordów, nie co rekord.</b></item>
///   <item><b>Artefakt zapisuje PRZED zmianą statusu</b> — inaczej istnieje moment, w którym
///     przebieg jest zakończony, a pliku jeszcze nie ma.</item>
/// </list>
///
/// <para><b>Wyłączność jest dwuczęściowa</b>, jak przy eksportach: krótka transakcja przejęcia
/// (<c>FOR UPDATE SKIP LOCKED</c> na wierszu <c>report_run</c>) i bicie serca w
/// <c>HeartbeatAt</c>, odświeżane przy okazji zapisu postępu. Przebieg „w toku" ze starym
/// znacznikiem wraca do puli — patrz <see cref="ReclaimAbandonedRunsAsync"/>.</para>
///
/// <para><see cref="ReportRun"/> jest klasą KONKRETNĄ (mirror <see cref="Jobs.Job"/>), nie
/// interfejsem generycznym per moduł — każdy moduł mapuje ją do własnej tabeli we własnym
/// schemacie, więc jedynym parametrem generycznym tego runnera jest <typeparamref name="TContext"/>.</para>
/// </summary>
/// <typeparam name="TContext">Kontekst modułu z tabelami <c>report_run</c>/<c>job</c>.</typeparam>
[ClusterSafe("Krótka transakcja przejęcia z FOR UPDATE SKIP LOCKED na wierszu report_run plus "
    + "bicie serca w HeartbeatAt; przebieg po martwym runnerze wraca do Pending po progu.")]
public sealed partial class ReportRunner<TContext> : BackgroundService
    where TContext : ErpDbContext, IJobDbContext, IReportRunDbContext
{
    /// <summary>Co ile rekordów odnotować postęp w bazie.</summary>
    private const int ProgressBatchSize = 500;

    private static readonly TimeSpan IdlePollingInterval = TimeSpan.FromSeconds(2);

    /// <summary>Próg, po jakim milczeniu uznajemy runnera za martwego — patrz uzasadnienie
    /// przy analogicznym polu w dawnym <c>ExportRunner</c>: hojny względem
    /// <see cref="ProgressBatchSize"/>, bo fałszywy odzysk (dwa runnery, jeden osierocony
    /// artefakt) jest kosztowniejszy niż kilka minut zwłoki po faktycznej awarii.</summary>
    internal static readonly TimeSpan HeartbeatTimeout = TimeSpan.FromMinutes(5);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ReportRunner<TContext>> _logger;

    public ReportRunner(IServiceScopeFactory scopeFactory, ILogger<ReportRunner<TContext>> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogRunnerStarted(_logger, typeof(TContext).Name);

        while (!stoppingToken.IsCancellationRequested)
        {
            bool didWork;

            try
            {
                didWork = await ProcessNextRunAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
#pragma warning disable CA1031 // Pętla runnera nie może paść przez błąd jednego przebiegu.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                LogRunFailed(_logger, ex);
                didWork = false;
            }

            if (didWork)
            {
                continue;
            }

            try
            {
                await Task.Delay(IdlePollingInterval, stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task<bool> ProcessNextRunAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();

        await ReclaimAbandonedRunsAsync(db, clock.UtcNow, _logger, cancellationToken).ConfigureAwait(false);

        var run = await ClaimNextRunAsync(db, clock.UtcNow, cancellationToken).ConfigureAwait(false);

        if (run is null)
        {
            return false;
        }

        var definition = ResolveDefinition(scope.ServiceProvider, run.ReportKey);

        var artifacts = scope.ServiceProvider.GetRequiredService<IArtifactStore>();
        var publisher = scope.ServiceProvider.GetRequiredService<IIntegrationEventPublisher>();

        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Uuid == run.JobUuid, cancellationToken)
            .ConfigureAwait(false);

        job?.MarkStarted(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            if (definition is null)
            {
                throw new DomainException(
                    "report_definition_not_found",
                    $"Brak zarejestrowanej definicji raportu dla klucza '{run.ReportKey}'.");
            }

            var recordCount = 0;
            var parameters = new ReportParameters(run.ParametersJson, run.Format);

            var artifactUuid = await artifacts.WriteAsync(
                new ArtifactDescriptor(
                    $"{run.ReportKey}-{run.CreatedAt:yyyyMMdd-HHmmss}.{run.Format}",
                    ReportFormatWriter.ContentTypeFor(run.Format),
                    run.ExpireOn),
                async (stream, ct) => recordCount = await ReportFormatWriter.WriteAsync(
                    run.Format,
                    definition.StreamAsync(parameters, ct),
                    stream,
                    async (count, innerCt) =>
                    {
                        if (count % ProgressBatchSize != 0)
                        {
                            return;
                        }

                        // Znak życia dopisuje się do UPDATE-u, który i tak tu leci — bicie serca
                        // nie kosztuje więc ani jednego dodatkowego polecenia SQL.
                        run.Heartbeat(clock.UtcNow);
                        job?.RecordReduceProgress(count);
                        await db.SaveChangesAsync(innerCt).ConfigureAwait(false);
                    },
                    ct).ConfigureAwait(false),
                cancellationToken).ConfigureAwait(false);

            // Kolejność jest istotna: artefakt istnieje, ZANIM przebieg ogłosi sukces.
            run.Complete(artifactUuid, recordCount, clock.UtcNow);
            job?.RecordReduceProgress(recordCount);

            // Referencja PRZED zamknięciem — inaczej istniałby moment, w którym zadanie jest
            // zakończone, a odnośnika do wyniku brak.
            job?.SetResultRef(run.Uuid.ToString());
            job?.Complete(clock.UtcNow);

            if (job is not null)
            {
                await publisher.PublishAsync(
                    new JobCompleted(
                        job.Uuid,
                        job.Status,
                        job.SucceededCount,
                        job.FailedCount,
                        null,
                        clock.UtcNow,
                        job.ResultRef),
                    cancellationToken).ConfigureAwait(false);
            }

            await publisher.SaveChangesAndFlushAsync(cancellationToken).ConfigureAwait(false);
            LogRunCompleted(_logger, run.Uuid, recordCount);
        }
#pragma warning disable CA1031 // Każdy błąd przebiegu ma zamknąć przebieg, a nie przewrócić runnera.
        catch (Exception ex)
#pragma warning restore CA1031
        {
            var errorCode = ex is DomainException domain ? domain.ErrorCode : "report_run_failed";

            run.Fail(errorCode, clock.UtcNow);
            job?.Fail(clock.UtcNow);

            if (job is not null)
            {
                await publisher.PublishAsync(
                    new JobCompleted(job.Uuid, job.Status, 0, 1, errorCode, clock.UtcNow),
                    cancellationToken).ConfigureAwait(false);
            }

            await publisher.SaveChangesAndFlushAsync(cancellationToken).ConfigureAwait(false);
            LogRunErrored(_logger, run.Uuid, errorCode, ex);
        }

        return true;
    }

    /// <summary>
    /// Odnajduje definicję po kluczu zapisanym w przebiegu.
    ///
    /// <para><c>GetServices</c>, nie kluczowana rejestracja jak przy <c>IBulkCommandExecutor</c>:
    /// definicje raportów są lekkie (samo zapytanie, żadnych zagnieżdżonych grafów handlerów)
    /// i jest ich niewiele na moduł, więc koszt skonstruowania wszystkich po to, żeby wybrać
    /// jedną, jest do pominięcia — inaczej niż przy egzekutorach komend.</para>
    /// </summary>
    private static IReportDefinition? ResolveDefinition(IServiceProvider services, string reportKey)
        => services.GetServices<IReportDefinition>()
            .FirstOrDefault(d => string.Equals(d.Key, reportKey, StringComparison.Ordinal));

    /// <summary>
    /// Przejmuje najstarszy oczekujący przebieg — krótką transakcją, pod <c>FOR UPDATE SKIP LOCKED</c>.
    /// </summary>
    internal static async Task<ReportRun?> ClaimNextRunAsync(
        TContext db,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var map = PostgresRowLock.Describe<ReportRun>(db);

        var sql =
            $"""
             SELECT {map.Column(nameof(ReportRun.Uuid))}
               FROM {map.Table}
              WHERE {map.Column(nameof(ReportRun.Status))} = @status
              ORDER BY {map.Column(nameof(ReportRun.CreatedAt))}
                FOR UPDATE SKIP LOCKED
              LIMIT 1
             """;

        var parameters = new[]
        {
            new NpgsqlParameter("status", NpgsqlDbType.Integer) { Value = (int)ReportRunStatus.Pending },
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken)
            .ConfigureAwait(false);

        var uuid = await PostgresRowLock.LockUuidAsync(db, sql, parameters, cancellationToken)
            .ConfigureAwait(false);

        if (uuid is null)
        {
            return null;
        }

        var run = await db.ReportRuns
            .FirstAsync(r => r.Uuid == uuid.Value, cancellationToken)
            .ConfigureAwait(false);

        run.MarkStarted(now);

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);

        return run;
    }

    /// <summary>Oddaje do puli przebiegi po runnerach, które przestały dawać znaki życia —
    /// patrz uzasadnienie przy analogicznej metodzie dawnego <c>ExportRunner</c>.</summary>
    internal static async Task<int> ReclaimAbandonedRunsAsync(
        TContext db,
        DateTimeOffset now,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var deadline = now - HeartbeatTimeout;

        var reclaimed = await db.ReportRuns
            .Where(r => r.Status == ReportRunStatus.Running
                && (r.HeartbeatAt == null || r.HeartbeatAt < deadline))
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(r => r.Status, ReportRunStatus.Pending)
                    .SetProperty(r => r.HeartbeatAt, (DateTimeOffset?)null),
                cancellationToken)
            .ConfigureAwait(false);

        if (reclaimed > 0)
        {
            LogRunsReclaimed(logger, reclaimed);
        }

        return reclaimed;
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "ReportRunner wystartował dla {Context}.")]
    private static partial void LogRunnerStarted(ILogger logger, string context);

    [LoggerMessage(EventId = 2, Level = LogLevel.Error, Message = "Nieoczekiwany błąd pętli ReportRunnera.")]
    private static partial void LogRunFailed(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 3, Level = LogLevel.Information,
        Message = "Przebieg raportu {RunUuid} zakończony — {RecordCount} wierszy.")]
    private static partial void LogRunCompleted(ILogger logger, Guid runUuid, int recordCount);

    [LoggerMessage(EventId = 4, Level = LogLevel.Error,
        Message = "Przebieg raportu {RunUuid} przerwany błędem {ErrorCode}.")]
    private static partial void LogRunErrored(ILogger logger, Guid runUuid, string errorCode, Exception exception);

    [LoggerMessage(EventId = 5, Level = LogLevel.Warning,
        Message = "Oddano do puli {Count} przebiegów raportu po runnerach bez znaku życia.")]
    private static partial void LogRunsReclaimed(ILogger logger, int count);
}
