using System.Globalization;
using System.Text;
using System.Xml;
using Catalog.Domain.ExportRuns;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

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
/// <para><b>Zakłada jedną instancję serwisu</b>, tak samo jak <c>BulkCommandRunner</c>: zapytanie
/// o najstarszy przebieg nie bierze lease'u ani locka, więc dwa runnery podjęłyby ten sam eksport.
/// Patrz <c>docs/backend/architecture.md</c> §7.</para>
/// </summary>
public sealed partial class ExportRunner : BackgroundService
{
    /// <summary>Co ile rekordów odnotować postęp w bazie.</summary>
    private const int ProgressBatchSize = 500;

    private static readonly TimeSpan IdlePollingInterval = TimeSpan.FromSeconds(2);

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

        var run = await db.ExportRuns
            .Where(r => r.Status == ExportRunStatus.Pending)
            .OrderBy(r => r.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (run is null)
        {
            return false;
        }

        var artifacts = scope.ServiceProvider.GetRequiredService<IArtifactStore>();
        var publisher = scope.ServiceProvider.GetRequiredService<IIntegrationEventPublisher>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();

        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Uuid == run.JobUuid, cancellationToken)
            .ConfigureAwait(false);

        run.MarkStarted();
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
                async (stream, ct) => recordCount = await WriteProductsXmlAsync(db, stream, job, ct)
                    .ConfigureAwait(false),
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
    /// Wypisuje produkty do strumienia XML, raportując postęp co <see cref="ProgressBatchSize"/>
    /// rekordów. Zwraca liczbę zapisanych rekordów.
    ///
    /// <para><c>AsAsyncEnumerable</c> zamiast <c>ToListAsync</c> — czytamy wiersz po wierszu prosto
    /// z czytnika bazy, więc rozmiar eksportu nie przekłada się na zużycie pamięci.</para>
    /// </summary>
    private static async Task<int> WriteProductsXmlAsync(
        CatalogDbContext db,
        Stream output,
        Erp.BuildingBlocks.Jobs.Job? job,
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

            if (job is not null && recordCount % ProgressBatchSize == 0)
            {
                job.RecordReduceProgress(recordCount);
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
}
