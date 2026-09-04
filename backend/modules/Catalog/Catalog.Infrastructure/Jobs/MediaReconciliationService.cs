using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Catalog.Infrastructure.Jobs;

/// <summary>Konfiguracja audytora rozjazdu, sekcja <c>MediaReconciliation</c>.</summary>
public sealed class MediaReconciliationOptions
{
    /// <summary>Nazwa sekcji konfiguracji.</summary>
    public const string SectionName = "MediaReconciliation";

    /// <summary>
    /// Czy audytor w ogóle chodzi. Domyślnie <b>nie</b>: to narzędzie diagnostyczne, a nie
    /// element normalnej pracy modułu. Włącza się je świadomie, gdy jest powód podejrzewać
    /// rozjazd — albo okresowo na środowisku produkcyjnym, po przeczytaniu reszty tych opcji.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Co ile godzin przebiega listowanie. Tydzień, nie minuta: to audyt, a nie pętla
    /// sprzątająca. Częstsze przebiegi nie znajdą więcej — znajdą to samo, obciążając magazyn.
    /// </summary>
    public int IntervalHours { get; set; } = 168;

    /// <summary>
    /// Ile dni musi mieć obiekt, żeby audytor w ogóle na niego spojrzał.
    ///
    /// <para><b>Bez tego progu audytor kasowałby pliki w trakcie ich wgrywania.</b> Między
    /// promocją obiektu do <c>assets/</c> a zatwierdzeniem transakcji jest okno, w którym plik
    /// istnieje, a wiersza jeszcze nie ma — dla listowania nieodróżnialne od sieroty.</para>
    /// </summary>
    public int MinimumAgeDays { get; set; } = 7;

    /// <summary>
    /// Czy wolno kasować, czy tylko raportować. Domyślnie <b>tylko raportować</b>.
    ///
    /// <para>Kasowanie włącza się po tym, jak przez kilka przebiegów raport jest pusty albo
    /// w całości zrozumiały. Audytor, który od pierwszego uruchomienia usuwa, jest audytorem,
    /// którego pierwszy fałszywy alarm kosztuje dane — a fałszywy alarm bierze się tu z rzeczy
    /// trywialnych, jak wskazanie na cudzy kubełek w konfiguracji.</para>
    /// </summary>
    public bool DeleteOrphans { get; set; }

    /// <summary>Ile identyfikatorów idzie do bazy w jednym zapytaniu.</summary>
    public int BatchSize { get; set; } = 500;
}

/// <summary>
/// Porównuje zawartość kubełka multimediów z katalogiem i zgłasza obiekty, których nie tłumaczy
/// żaden wiersz — <b>audytor, nie garbage collector</b>.
///
/// <para><b>Czego ten serwis NIE sprząta</b>, bo sprzątają to mechanizmy, które nie mogą się
/// pomylić (<c>docs/guides/backend/media-storage.md</c> §4):</para>
/// <list type="bullet">
///   <item>plików wgranych, po których nie przyszła komenda — te umierają z reguły lifecycle
///   na prefiksie <c>staging/</c> i nigdy nie trafiają do <c>assets/</c>;</item>
///   <item>plików po usuniętych zasobach — te kasuje konsument
///   <c>ArtifactDeletionRequested</c>, wypuszczony przez outbox w transakcji usunięcia;</item>
///   <item>zasobów bez referencji — te <b>nie są śmieciem</b>. Biblioteka mediów trzyma pozycje
///   niezależnie od tego, czy ktoś ich teraz używa.</item>
/// </list>
///
/// <para>Zostaje wąski margines: obiekt, który przeżył awarię w nietypowym momencie — np. gdy
/// promocja pliku poszła, a transakcja się wywróciła. <b>Jeżeli ten serwis regularnie coś
/// znajduje, to jest objaw, że któryś z trzech mechanizmów wyżej jest zepsuty</b>, a nie dowód,
/// że sprzątanie działa.</para>
///
/// <para><b>Wiele instancji.</b> Przebieg bierze dzierżawę <c>catalog:media-reconciliation</c>
/// (<see cref="IExclusiveLease"/>); instancja, która jej nie dostanie, <b>pomija ten przebieg</b>
/// i czeka na następny. Pominięcie jest tu bez znaczenia — cykl liczy się w godzinach, a robota
/// i tak sprowadza się do „sprawdź, czy nie ma śmieci". Bez dzierżawy dwie instancje listowałyby
/// ten sam kubełek i kasowały te same obiekty.</para>
/// </summary>
[ClusterSafe("Dzierżawa catalog:media-reconciliation na advisory locku Postgresa; instancja bez "
    + "dzierżawy pomija przebieg, a cykl godzinowy sprawia, że pominięcie nic nie kosztuje.")]
public sealed partial class MediaReconciliationService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MediaReconciliationOptions _options;
    private readonly ILogger<MediaReconciliationService> _logger;

    public MediaReconciliationService(
        IServiceScopeFactory scopeFactory,
        IOptions<MediaReconciliationOptions> options,
        ILogger<MediaReconciliationService> logger)
    {
        ArgumentNullException.ThrowIfNull(options);

        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            LogDisabled(_logger);
            return;
        }

        var interval = TimeSpan.FromHours(Math.Max(1, _options.IntervalHours));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ReconcileAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
#pragma warning disable CA1031 // Awaria audytu nie może zatrzymać modułu ani samej pętli.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                LogRunFailed(_logger, ex);
            }

            try
            {
                await Task.Delay(interval, stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private async Task ReconcileAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();

        // Wyłączność bierzemy PRZED jakąkolwiek pracą, ale wewnątrz scope'u — dzierżawa jest
        // zasobem scope'u tak samo jak DbContext, a trzymanie jej dłużej niż przebieg nie ma sensu.
        var lease = scope.ServiceProvider.GetRequiredService<IExclusiveLease>();
        await using var held = await lease
            .TryAcquireAsync("catalog:media-reconciliation", cancellationToken)
            .ConfigureAwait(false);

        if (held is null)
        {
            return;
        }

        var artifacts = scope.ServiceProvider.GetRequiredKeyedService<IArtifactStore>(ArtifactStoreKeys.Media);
        var queries = scope.ServiceProvider.GetRequiredService<IMultimediaQueries>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();

        var cutoff = clock.UtcNow.AddDays(-Math.Max(1, _options.MinimumAgeDays));
        var batchSize = Math.Max(1, _options.BatchSize);

        var inspected = 0;
        var orphans = 0;
        var batch = new List<ArtifactListEntry>(batchSize);

        await foreach (var entry in artifacts.ListAsync(cancellationToken).ConfigureAwait(false))
        {
            // Obiekt bez znacznika czasu traktujemy jak świeży — brak informacji nie jest
            // powodem, żeby uznać plik za porzucony.
            if (entry.LastModified is null || entry.LastModified > cutoff)
            {
                continue;
            }

            batch.Add(entry);
            inspected++;

            if (batch.Count >= batchSize)
            {
                orphans += await HandleBatchAsync(batch, artifacts, queries, cancellationToken).ConfigureAwait(false);
                batch.Clear();
            }
        }

        if (batch.Count > 0)
        {
            orphans += await HandleBatchAsync(batch, artifacts, queries, cancellationToken).ConfigureAwait(false);
        }

        LogRunFinished(_logger, inspected, orphans, _options.DeleteOrphans);
    }

    private async Task<int> HandleBatchAsync(
        List<ArtifactListEntry> batch,
        IArtifactStore artifacts,
        IMultimediaQueries queries,
        CancellationToken cancellationToken)
    {
        var known = await queries
            .GetKnownArtifactUuidsAsync([.. batch.Select(e => e.Uuid)], cancellationToken)
            .ConfigureAwait(false);

        var orphans = batch.Where(e => !known.Contains(e.Uuid)).ToList();

        foreach (var orphan in orphans)
        {
            // Każda sierota trafia do logu ZAWSZE, niezależnie od trybu. W trybie raportowania
            // to jedyny wynik przebiegu; w trybie kasowania — zapis, po którym da się odtworzyć,
            // co zniknęło i dlaczego.
            LogOrphanFound(_logger, orphan.Uuid, orphan.SizeBytes, orphan.LastModified);

            if (_options.DeleteOrphans)
            {
                await artifacts.DeleteAsync(orphan.Uuid, cancellationToken).ConfigureAwait(false);
            }
        }

        return orphans.Count;
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Debug,
        Message = "Audyt magazynu multimediów wyłączony (MediaReconciliation:Enabled).")]
    private static partial void LogDisabled(ILogger logger);

    [LoggerMessage(EventId = 2, Level = LogLevel.Warning,
        Message = "Artefakt {ArtifactUuid} ({SizeBytes} B, {LastModified}) nie ma wpisu w katalogu. "
            + "Jeśli takich obiektów jest więcej niż pojedyncze sztuki, zepsuty jest jeden "
            + "z mechanizmów sprzątania, a nie ten artefakt.")]
    private static partial void LogOrphanFound(
        ILogger logger,
        Guid artifactUuid,
        long sizeBytes,
        DateTimeOffset? lastModified);

    [LoggerMessage(EventId = 3, Level = LogLevel.Information,
        Message = "Audyt magazynu multimediów: sprawdzono {Inspected}, sierot {Orphans}, kasowanie: {Deleting}.")]
    private static partial void LogRunFinished(ILogger logger, int inspected, int orphans, bool deleting);

    [LoggerMessage(EventId = 4, Level = LogLevel.Error,
        Message = "Przebieg audytu magazynu multimediów nie powiódł się. Kolejny wystartuje o czasie.")]
    private static partial void LogRunFailed(ILogger logger, Exception exception);
}
