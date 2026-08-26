using System.Globalization;
using System.Text;
using System.Xml;
using Catalog.Domain.ExportRuns;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace Catalog.Infrastructure.Jobs;

/// <summary>
/// Wykonuje przebiegi eksportu — odpowiednik <c>BulkCommandRunner</c> dla zadań
/// <see cref="JobKind.Reduce"/> (patrz <c>docs/backend/exports-artifacts.md</c> §4).
///
/// <para>Trzy rzeczy odróżniają go od runnera map-owego:</para>
/// <list type="number">
///   <item><b>Strumieniuje, nie materializuje.</b> Źródłem jest <c>IAsyncEnumerable</c> z zapytania
///     <c>AsNoTracking</c>, wyjściem strumień do magazynu artefaktów. Wciągnięcie 50 tys. rekordów
///     do pamięci tylko po to, żeby je zaraz zserializować, jest dokładnie tym błędem, który
///     <c>bulk-commands.md</c> opisuje przy <c>COPY</c>.</item>
///   <item><b>Postęp zapisuje co N rekordów, nie co rekord.</b> Zapis licznika po każdym wierszu
///     to 50 tys. UPDATE-ów; co <see cref="ProgressBatchSize"/> wystarcza, żeby pasek postępu
///     wyglądał na żywy.</item>
///   <item><b>Artefakt zapisuje PRZED zmianą statusu.</b> Odwrotna kolejność daje moment,
///     w którym przebieg jest zakończony, a pliku jeszcze nie ma — czyli przycisk „Pobierz"
///     prowadzący w pustkę.</item>
/// </list>
///
/// <para><b>Wyłączność jest dwuczęściowa</b> i to jest jego czwarta różnica względem runnera
/// map-owego. Wzorzec „<c>FOR UPDATE SKIP LOCKED</c> na czas całej pracy" tutaj nie zadziała:
/// przebieg strumieniuje dziesiątki tysięcy rekordów do MinIO, a trzymanie transakcji Postgresa
/// przez ten czas to długowieczny snapshot blokujący <c>VACUUM</c> — lekarstwo gorsze od choroby.
/// Zamiast tego: <b>krótka transakcja przejęcia</b> (milisekundy, pod <c>SKIP LOCKED</c>)
/// i <b>bicie serca</b> w <c>export_run.heartbeat_at</c>, odświeżane przy okazji zapisu postępu.
/// Przebieg „w toku" ze starym znacznikiem wraca do puli — patrz <c>ReclaimAbandonedRunsAsync</c>.</para>
///
/// <para>Pominięcie tego kroku bolałoby bardziej niż przy zadaniach masowych: dwa runnery
/// wyprodukowałyby dwa artefakty dla jednego przebiegu, z których jeden zostałby osierocony
/// w magazynie — bez wiersza, który by o nim wiedział, więc bez szans na posprzątanie inaczej
/// niż regułą lifecycle.</para>
/// </summary>
[ClusterSafe("Krótka transakcja przejęcia z FOR UPDATE SKIP LOCKED na wierszu export_run plus "
    + "bicie serca w heartbeat_at; przebieg po martwym runnerze wraca do Pending po progu.")]
public sealed partial class ExportRunner : BackgroundService
{
    /// <summary>Co ile rekordów odnotować postęp w bazie.</summary>
    private const int ProgressBatchSize = 500;

    private static readonly TimeSpan IdlePollingInterval = TimeSpan.FromSeconds(2);

    /// <summary>
    /// Po jakim milczeniu uznajemy runnera za martwego i oddajemy przebieg do puli.
    ///
    /// <para>Próg jest świadomie hojny względem <see cref="ProgressBatchSize"/>. Fałszywy odzysk
    /// (runner żyje, tylko wolno mu idzie porcja rekordów) kończy się dwoma runnerami nad jednym
    /// przebiegiem, a więc osieroconym artefaktem — jest więc kosztowniejszy niż kilka minut
    /// zwłoki w odzysku po faktycznej awarii. Gdyby porcja 500 rekordów zaczęła trwać dłużej niż
    /// ten próg, właściwą reakcją jest zmniejszenie porcji, a nie podniesienie progu.</para>
    /// </summary>
    internal static readonly TimeSpan HeartbeatTimeout = TimeSpan.FromMinutes(5);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ExportRunner> _logger;

    public ExportRunner(IServiceScopeFactory scopeFactory, ILogger<ExportRunner> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogRunnerStarted(_logger);

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
        var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();

        await ReclaimAbandonedRunsAsync(db, clock.UtcNow, _logger, cancellationToken).ConfigureAwait(false);

        var run = await ClaimNextRunAsync(db, clock.UtcNow, cancellationToken).ConfigureAwait(false);

        if (run is null)
        {
            return false;
        }

        var artifacts = scope.ServiceProvider.GetRequiredService<IArtifactStore>();
        var publisher = scope.ServiceProvider.GetRequiredService<IIntegrationEventPublisher>();

        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Uuid == run.JobUuid, cancellationToken)
            .ConfigureAwait(false);

        job?.MarkStarted(clock.UtcNow);
        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var totalCount = await db.Products.AsNoTracking().CountAsync(cancellationToken).ConfigureAwait(false);
        if (job is not null)
        {
            job.SetTotalCount(totalCount);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        try
        {
            var recordCount = 0;

            var artifactUuid = await artifacts.WriteAsync(
                new ArtifactDescriptor(
                    $"catalog-export-{run.CreatedAt:yyyyMMdd-HHmmss}.{run.Format}",
                    ContentTypeFor(run.Format),
                    run.ExpireOn),
                async (stream, ct) => recordCount =
                    await WriteProductsXmlAsync(db, stream, run, job, clock, ct).ConfigureAwait(false),
                cancellationToken).ConfigureAwait(false);

            // Kolejność jest istotna: artefakt istnieje, ZANIM przebieg ogłosi sukces.
            run.Complete(artifactUuid, recordCount, clock.UtcNow);
            job?.RecordReduceProgress(recordCount);

            // Referencja PRZED zamknięciem — inaczej istniałby moment, w którym zadanie
            // jest zakończone, a odnośnika do wyniku brak.
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
            var errorCode = ex is DomainException domain ? domain.ErrorCode : "export_run_failed";

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
    /// Przejmuje najstarszy oczekujący przebieg — krótką transakcją, pod <c>FOR UPDATE SKIP LOCKED</c>.
    ///
    /// <para>Transakcja żyje tyle, co przestawienie statusu: blokada ma rozstrzygnąć, <b>kto</b>
    /// bierze przebieg, a nie towarzyszyć całej jego pracy. Zwrócony agregat jest już
    /// <see cref="ExportRunStatus.Running"/> i zatwierdzony, więc żaden inny runner go nie zobaczy.</para>
    /// </summary>
    internal static async Task<ExportRun?> ClaimNextRunAsync(
        CatalogDbContext db,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var map = PostgresRowLock.Describe<ExportRun>(db);

        var sql =
            $"""
             SELECT {map.Column(nameof(ExportRun.Uuid))}
               FROM {map.Table}
              WHERE {map.Column(nameof(ExportRun.Status))} = @status
              ORDER BY {map.Column(nameof(ExportRun.CreatedAt))}
                FOR UPDATE SKIP LOCKED
              LIMIT 1
             """;

        var parameters = new[]
        {
            new NpgsqlParameter("status", NpgsqlDbType.Integer) { Value = (int)ExportRunStatus.Pending },
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken)
            .ConfigureAwait(false);

        var uuid = await PostgresRowLock.LockUuidAsync(db, sql, parameters, cancellationToken)
            .ConfigureAwait(false);

        if (uuid is null)
        {
            return null;
        }

        var run = await db.ExportRuns.FirstAsync(r => r.Uuid == uuid.Value, cancellationToken)
            .ConfigureAwait(false);

        run.MarkStarted(now);

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);

        return run;
    }

    /// <summary>
    /// Oddaje do puli przebiegi po runnerach, które przestały dawać znaki życia.
    ///
    /// <returns>Liczba oddanych przebiegów.</returns>
    /// <para>Jedno <c>UPDATE</c> po predykacie — druga instancja robiąca to samo w tej samej chwili
    /// ustawia te same wartości w tych samych wierszach, więc operacja jest naturalnie bezpieczna
    /// i nie wymaga żadnej wyłączności.</para>
    ///
    /// <para>Naprawia to usterkę istniejącą <b>już przy jednej instancji</b>: dotąd padnięcie
    /// runnera w połowie eksportu zostawiało przebieg w stanie „w toku" na zawsze, a użytkownik
    /// oglądał pasek postępu, za którym nie stał żaden proces.</para>
    /// </summary>
    internal static async Task<int> ReclaimAbandonedRunsAsync(
        CatalogDbContext db,
        DateTimeOffset now,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var deadline = now - HeartbeatTimeout;

        var reclaimed = await db.ExportRuns
            .Where(r => r.Status == ExportRunStatus.Running)
            .Where(r => r.HeartbeatAt == null || r.HeartbeatAt < deadline)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(r => r.Status, ExportRunStatus.Pending)
                    .SetProperty(r => r.HeartbeatAt, (DateTimeOffset?)null),
                cancellationToken)
            .ConfigureAwait(false);

        if (reclaimed > 0)
        {
            LogRunsReclaimed(logger, reclaimed);
        }

        return reclaimed;
    }

    /// <summary>
    /// Wypisuje produkty do strumienia XML, raportując postęp co <see cref="ProgressBatchSize"/>
    /// rekordów. Zwraca liczbę zapisanych rekordów.
    ///
    /// <para><c>AsAsyncEnumerable</c> zamiast <c>ToListAsync</c> — czytamy wiersz po wierszu prosto
    /// z czytnika bazy, więc rozmiar eksportu nie przekłada się na zużycie pamięci.</para>
    /// </summary>
    private static async Task<int> WriteProductsXmlAsync(
        CatalogDbContext db,
        Stream output,
        ExportRun run,
        Erp.BuildingBlocks.Jobs.Job? job,
        IClock clock,
        CancellationToken cancellationToken)
    {
        var settings = new XmlWriterSettings
        {
            Async = true,
            Indent = true,
            Encoding = new UTF8Encoding(false),
        };

        await using var writer = XmlWriter.Create(output, settings);

        await writer.WriteStartDocumentAsync().ConfigureAwait(false);
        await writer.WriteStartElementAsync(prefix: null, "products", ns: null).ConfigureAwait(false);

        var recordCount = 0;

        var source = db.Products
            .AsNoTracking()
            .OrderBy(p => p.Uuid)
            .Select(p => new { p.Uuid, p.Name, p.Price, p.Status })
            .AsAsyncEnumerable();

        await foreach (var product in source.WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            await writer.WriteStartElementAsync(prefix: null, "product", ns: null).ConfigureAwait(false);
            await writer.WriteAttributeStringAsync(null, "uuid", null, product.Uuid.ToString()).ConfigureAwait(false);
            await writer.WriteAttributeStringAsync(null, "name", null, product.Name).ConfigureAwait(false);
            await writer.WriteAttributeStringAsync(
                null, "price", null, product.Price.ToString(CultureInfo.InvariantCulture)).ConfigureAwait(false);
            await writer.WriteAttributeStringAsync(
                null, "status", null, product.Status.ToString()).ConfigureAwait(false);
            await writer.WriteEndElementAsync().ConfigureAwait(false);

            recordCount++;

            if (recordCount % ProgressBatchSize == 0)
            {
                // Znak życia dopisuje się do UPDATE-u, który i tak tu leci — bicie serca nie
                // kosztuje więc ani jednego dodatkowego polecenia SQL.
                run.Heartbeat(clock.UtcNow);
                job?.RecordReduceProgress(recordCount);
                await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }
        }

        await writer.WriteEndElementAsync().ConfigureAwait(false);
        await writer.WriteEndDocumentAsync().ConfigureAwait(false);
        await writer.FlushAsync().ConfigureAwait(false);

        return recordCount;
    }

    private static string ContentTypeFor(string format) => format switch
    {
        "xml" => "application/xml",
        "csv" => "text/csv",
        _ => "application/octet-stream",
    };

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "ExportRunner wystartował.")]
    private static partial void LogRunnerStarted(ILogger logger);

    [LoggerMessage(EventId = 2, Level = LogLevel.Error, Message = "Nieoczekiwany błąd pętli ExportRunnera.")]
    private static partial void LogRunFailed(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 3, Level = LogLevel.Information,
        Message = "Przebieg eksportu {RunUuid} zakończony — {RecordCount} rekordów.")]
    private static partial void LogRunCompleted(ILogger logger, Guid runUuid, int recordCount);

    [LoggerMessage(EventId = 4, Level = LogLevel.Error,
        Message = "Przebieg eksportu {RunUuid} przerwany błędem {ErrorCode}.")]
    private static partial void LogRunErrored(ILogger logger, Guid runUuid, string errorCode, Exception exception);

    [LoggerMessage(EventId = 5, Level = LogLevel.Warning,
        Message = "Oddano do puli {Count} przebiegów eksportu po runnerach bez znaku życia.")]
    private static partial void LogRunsReclaimed(ILogger logger, int count);
}
