using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Erp.BuildingBlocks.Jobs;

/// <summary>
/// Silnik wykonujący zadania masowe. Czyta je <b>z bazy</b>, a nie z kolejki w pamięci —
/// dzięki temu restart procesu w połowie operacji na 50 tys. produktów wznawia pracę
/// od pierwszego nieprzetworzonego elementu, zamiast gubić całość.
///
/// <para><b>Granica transakcji.</b> Jeden chunk to jeden commit: statusy elementów, liczniki
/// zadania i zdarzenia w outboxie zapisują się razem. Nie da się więc doprowadzić do stanu,
/// w którym produkt jest zmieniony, ale zadanie o tym nie wie (albo odwrotnie).</para>
///
/// <para><b>Częściowe niepowodzenie.</b> Naruszenie reguły biznesowej dla jednego elementu
/// nie przerywa chunka — element dostaje status i kod błędu, reszta idzie dalej. Opiera się to
/// na konwencji obowiązującej w całym modelu domenowym: <i>metoda agregatu waliduje przed
/// zmianą stanu</i>, więc <see cref="DomainException"/> oznacza, że nic się nie zmieniło
/// i transakcja pozostaje czysta.</para>
///
/// <para><b>Awaria zapisu.</b> Konflikt optymistyczny albo błąd bazy przy zapisie chunka
/// unieważnia całą transakcję, a wtedy nie wiadomo, który element ją zepsuł. Runner powtarza
/// wówczas ten sam chunk element po elemencie, każdy we własnej transakcji: winowajca dostaje
/// własny wpis o błędzie, a pozostałe elementy przechodzą. Kosztowna ścieżka, ale wchodzi
/// wyłącznie po faktycznej awarii — bez niej jeden konfliktujący wiersz blokowałby całe zadanie
/// w nieskończonej pętli ponowień.</para>
/// </summary>
/// <typeparam name="TContext">Kontekst modułu z tabelami zadań.</typeparam>
public sealed partial class BulkCommandRunner<TContext> : BackgroundService
    where TContext : ErpDbContext, IJobDbContext
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly BulkJobOptions _options;
    private readonly ILogger<BulkCommandRunner<TContext>> _logger;

    public BulkCommandRunner(
        IServiceScopeFactory scopeFactory,
        IOptions<BulkJobOptions> options,
        ILogger<BulkCommandRunner<TContext>> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options?.Value ?? new BulkJobOptions();
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogRunnerStarted(_logger, typeof(TContext).Name, _options.ChunkSize);

        while (!stoppingToken.IsCancellationRequested)
        {
            bool didWork;

            try
            {
                didWork = await ProcessNextChunkAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
#pragma warning disable CA1031 // Pętla runnera nie może paść przez błąd jednego zadania.
            catch (Exception ex)
#pragma warning restore CA1031
            {
                LogChunkFailed(_logger, ex);
                didWork = false;
            }

            if (!didWork)
            {
                try
                {
                    await Task.Delay(_options.IdlePollingInterval, stoppingToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }

    /// <summary>Przetwarza jeden chunk najstarszego niezakończonego zadania.</summary>
    /// <returns><c>true</c>, jeśli coś zrobiono (warto od razu iterować dalej).</returns>
    private async Task<bool> ProcessNextChunkAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TContext>();

        var job = await db.Jobs
            .Where(j => j.Status == JobStatus.Pending || j.Status == JobStatus.Running)
            .OrderBy(j => j.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (job is null)
        {
            return false;
        }

        var itemUuids = await db.JobItems
            .Where(i => i.JobUuid == job.Uuid && i.Status == JobItemStatus.Pending)
            .OrderBy(i => i.Ordinal)
            .Take(EffectiveChunkSize(job.TotalCount))
            .Select(i => i.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (itemUuids.Count == 0)
        {
            await FinishJobAsync(scope, db, job, cancellationToken).ConfigureAwait(false);
            return true;
        }

        var succeeded = await TryProcessAsync(job.Uuid, itemUuids, cancellationToken).ConfigureAwait(false);

        if (!succeeded)
        {
            LogIsolatingChunk(_logger, job.Uuid, itemUuids.Count);

            // Zapis chunka padł — powtarzamy element po elemencie, żeby odizolować winowajcę.
            foreach (var itemUuid in itemUuids)
            {
                await TryProcessAsync(job.Uuid, [itemUuid], cancellationToken).ConfigureAwait(false);
            }
        }

        return true;
    }

    /// <summary>
    /// Rozmiar porcji dla zadania o danej wielkości.
    ///
    /// <para>Postęp widać dopiero po zatwierdzeniu chunka — koperta <c>JobProgressed</c> leży
    /// w outboxie tej samej transakcji, więc dopóki zadanie mieści się w jednym chunku,
    /// licznik stoi na zerze aż do końca. Dla wsadu na pięć produktów „0/5 → 5/5" jest
    /// technicznie poprawne i praktycznie nieodróżnialne od zawieszenia, dlatego małe zadania
    /// dzielimy na <see cref="BulkJobOptions.ProgressUpdateTarget"/> porcji.</para>
    ///
    /// <para>Wynik nigdy nie przekracza <see cref="BulkJobOptions.ChunkSize"/>, więc
    /// przepustowość dużych zadań zostaje bez zmian — rachunek płacą wyłącznie wsady mniejsze
    /// niż chunk, kilkoma dodatkowymi commitami.</para>
    /// </summary>
    private int EffectiveChunkSize(int totalCount)
    {
        if (_options.ProgressUpdateTarget <= 1 || totalCount <= 0)
        {
            return _options.ChunkSize;
        }

        var target = (int)Math.Ceiling(totalCount / (double)_options.ProgressUpdateTarget);
        var floor = Math.Max(1, _options.MinChunkSize);

        // `Math.Clamp` wywala się, gdy dolna granica przekracza górną — a przy sprzecznej
        // konfiguracji (MinChunkSize > ChunkSize) runner ma pracować dalej, nie paść.
        var ceiling = Math.Max(floor, _options.ChunkSize);

        return Math.Clamp(target, floor, ceiling);
    }

    /// <summary>
    /// Wykonuje wskazane elementy w jednym scope DI i jednej transakcji.
    /// </summary>
    /// <returns><c>false</c>, jeśli zapis się nie powiódł i trzeba wejść w tryb izolacji.</returns>
    // List<Guid> zamiast IReadOnlyList<Guid> nie jest przypadkiem: tłumaczenie `Contains`
    // na SQL przez EF Core działa wydajniej na konkretnym typie kolekcji.
    private async Task<bool> TryProcessAsync(
        Guid jobUuid,
        List<Guid> itemUuids,
        CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<TContext>();
        var clock = services.GetRequiredService<IClock>();

        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Uuid == jobUuid, cancellationToken).ConfigureAwait(false);
        if (job is null)
        {
            return true;
        }

        if (job.Status == JobStatus.Cancelled)
        {
            return true;
        }

        // Zadanie żyje dłużej niż żądanie HTTP, które je zleciło — odtwarzamy kontekst
        // zleceniodawcy, żeby zdarzenia i powiadomienia trafiły do właściwego użytkownika.
        if (services.GetService<IExecutionContext>() is MutableExecutionContext executionContext)
        {
            executionContext.Set(job.UserId, job.ClientId, job.CorrelationId);
        }

        var executor = ResolveExecutor(services, job.CommandType);

        var items = await db.JobItems
            .Where(i => itemUuids.Contains(i.Uuid))
            .OrderBy(i => i.Ordinal)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var now = clock.UtcNow;
        job.MarkStarted(now);

        var succeededCount = 0;
        var failedCount = 0;

        foreach (var item in items)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                // Payload elementu ma pierwszeństwo przed szablonem zadania. Tryb `Commands`
                // (lista różnych komend) nie ma szablonu w ogóle, więc sięgnięcie po samo
                // `job.CommandJson` dawałoby pustą komendę z wartościami domyślnymi —
                // czyli operację, która „się udaje”, nie robiąc tego, o co prosił użytkownik.
                var payload = item.CommandJson ?? job.CommandJson;

                await executor.ExecuteAsync(item.AggregateUuid, payload, cancellationToken)
                    .ConfigureAwait(false);
                item.MarkSucceeded(now);
                succeededCount++;
            }
            catch (DomainException ex)
            {
                // Reguła domenowa waliduje przed zmianą stanu, więc kontekst pozostaje czysty
                // i pozostałe elementy chunka mogą się zapisać.
                item.MarkFailed(ex.ErrorCode, ex.Message, _options.MaxAttempts, now);

                // Do liczników zadania wchodzą wyłącznie stany końcowe — element, który wróci
                // do puli ponowień, nie może być policzony jako porażka, bo przy kolejnej próbie
                // policzylibyśmy go drugi raz.
                if (item.Status == JobItemStatus.Failed)
                {
                    failedCount++;
                }
            }
        }

        job.RecordChunkResult(succeededCount, failedCount);

        var publisher = services.GetRequiredService<IIntegrationEventPublisher>();
        await publisher.PublishAsync(
            new JobProgressed(job.Uuid, job.SucceededCount, job.FailedCount, job.TotalCount, now),
            cancellationToken).ConfigureAwait(false);

        var unitOfWork = services.GetRequiredService<IUnitOfWork>();

        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch (DbUpdateException ex)
        {
            LogSaveFailed(_logger, jobUuid, items.Count, ex);

            // Pojedynczy element już w trybie izolacji — dalsze dzielenie nic nie da,
            // więc odnotowujemy trwałą porażkę osobnym, czystym kontekstem.
            if (itemUuids.Count == 1)
            {
                await RecordIsolatedFailureAsync(itemUuids[0], ex, cancellationToken).ConfigureAwait(false);
                return true;
            }

            return false;
        }
    }

    /// <summary>
    /// Zapisuje porażkę elementu, którego nie dało się zapisać razem z chunkiem.
    /// Wymaga świeżego scope'u — kontekst po nieudanym <c>SaveChanges</c> jest nieużywalny.
    /// </summary>
    private async Task RecordIsolatedFailureAsync(
        Guid itemUuid,
        DbUpdateException exception,
        CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();

        var item = await db.JobItems.FirstOrDefaultAsync(i => i.Uuid == itemUuid, cancellationToken)
            .ConfigureAwait(false);

        if (item is null)
        {
            return;
        }

        // Naruszenie unikalności to reguła biznesowa przebrana za awarię zapisu. Bez tłumaczenia
        // element dostałby `persistence_error` i wracał do puli ponowień (MarkFailed odsyła go
        // do Pending, dopóki nie wyczerpie MaxAttempts) — mimo że duplikat jest trwały i każda
        // kolejna próba skończy się identycznie. Stąd maxAttempts: 1 dla przetłumaczonych.
        var translator = scope.ServiceProvider.GetService<IPersistenceExceptionTranslator>();

        if (translator is not null && translator.TryTranslate(exception, out var domainException))
        {
            item.MarkFailed(domainException.ErrorCode, domainException.Message, maxAttempts: 1, clock.UtcNow);
        }
        else
        {
            var errorCode = exception is DbUpdateConcurrencyException ? "concurrency_conflict" : "persistence_error";
            item.MarkFailed(errorCode, exception.Message, _options.MaxAttempts, clock.UtcNow);
        }

        if (item.Status == JobItemStatus.Failed)
        {
            var job = await db.Jobs.FirstOrDefaultAsync(j => j.Uuid == item.JobUuid, cancellationToken)
                .ConfigureAwait(false);
            job?.RecordChunkResult(0, 1);
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Zamyka zadanie i publikuje podsumowanie.</summary>
    private static async Task FinishJobAsync(
        IServiceScope scope,
        TContext db,
        Job job,
        CancellationToken cancellationToken)
    {
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();
        job.Complete(clock.UtcNow);

        var errorsSummary = await BuildErrorsSummaryAsync(db, job.Uuid, cancellationToken).ConfigureAwait(false);

        var publisher = scope.ServiceProvider.GetRequiredService<IIntegrationEventPublisher>();
        await publisher.PublishAsync(
            new JobCompleted(job.Uuid, job.Status, job.SucceededCount, job.FailedCount, errorsSummary, clock.UtcNow),
            cancellationToken).ConfigureAwait(false);

        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Buduje podsumowanie błędów zgrupowane po kodzie — celowo agregat, nie lista.
    /// „1200 × price_negative” niesie dla użytkownika tę samą informację co 1200 osobnych
    /// komunikatów, a mieści się w powiadomieniu.
    /// </summary>
    private static async Task<string?> BuildErrorsSummaryAsync(
        TContext db,
        Guid jobUuid,
        CancellationToken cancellationToken)
    {
        var groups = await db.JobItems
            .Where(i => i.JobUuid == jobUuid && i.Status == JobItemStatus.Failed && i.ErrorCode != null)
            .GroupBy(i => i.ErrorCode!)
            .Select(g => new { ErrorCode = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return groups.Count == 0
            ? null
            : string.Join("; ", groups.Select(g => $"{g.ErrorCode}: {g.Count}"));
    }

    private static IBulkCommandExecutor ResolveExecutor(IServiceProvider services, string commandType)
    {
        var executor = services
            .GetServices<IBulkCommandExecutor>()
            .FirstOrDefault(e => string.Equals(e.CommandType, commandType, StringComparison.Ordinal));

        return executor ?? throw new InvalidOperationException(
            $"Brak zarejestrowanego {nameof(IBulkCommandExecutor)} dla komendy '{commandType}'. " +
            "Zarejestruj go w kontenerze DI modułu wykonującego zadanie.");
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Information,
        Message = "BulkCommandRunner wystartował dla {Context} (chunk: {ChunkSize}).")]
    private static partial void LogRunnerStarted(ILogger logger, string context, int chunkSize);

    [LoggerMessage(EventId = 2, Level = LogLevel.Error,
        Message = "Nieoczekiwany błąd przetwarzania chunka zadania masowego.")]
    private static partial void LogChunkFailed(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 3, Level = LogLevel.Warning,
        Message = "Zapis chunka zadania {JobUuid} ({ItemCount} elementów) nie powiódł się.")]
    private static partial void LogSaveFailed(ILogger logger, Guid jobUuid, int itemCount, Exception exception);

    [LoggerMessage(EventId = 4, Level = LogLevel.Warning,
        Message = "Powtarzam chunk zadania {JobUuid} element po elemencie ({ItemCount} elementów).")]
    private static partial void LogIsolatingChunk(ILogger logger, Guid jobUuid, int itemCount);
}
