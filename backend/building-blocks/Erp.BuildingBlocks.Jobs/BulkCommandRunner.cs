using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Application.Commands;
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
/// <para><b>Granica transakcji.</b> Jeden chunk to jeden commit: <b>wybór zadania</b>, statusy
/// elementów, liczniki zadania i zdarzenia w outboxie zapisują się razem. Nie da się więc
/// doprowadzić do stanu, w którym produkt jest zmieniony, ale zadanie o tym nie wie (albo
/// odwrotnie).</para>
///
/// <para><b>Wiele instancji.</b> Wybór zadania idzie przez <see cref="JobQueueLock{TContext}"/>
/// (<c>FOR UPDATE SKIP LOCKED</c>) i dzieje się w TEJ SAMEJ transakcji co wykonanie chunka.
/// Dwa runnery nie wezmą więc tego samego zadania: jeden runner na zadanie, N runnerów nad
/// N zadaniami. Blokada puszcza commit, a przy awarii procesu — zerwana sesja Postgresa, więc
/// nie ma osieroconych dzierżaw ani reguły ich odzysku.</para>
///
/// <para><b>Jeden chunk to też jedno wczytanie.</b> Przed pętlą runner woła
/// <see cref="IBulkCommandExecutor.PreloadAsync"/>, które wciąga agregaty całego chunka do
/// jednostki pracy jednym zapytaniem. Bez tego handler każdego elementu pobierałby swój agregat
/// osobno — a przy agregacie z kolekcjami po jednym zapytaniu NA KOLEKCJĘ, bo globalne
/// <c>SplitQuery</c> rozbija każdy <c>Include</c> na osobny SELECT. Na Catalogu zmierzono
/// 3000 poleceń SQL na chunk 500 produktów; po wczytaniu wsadowym jest ich 6, a dla komend
/// dotykających wyłącznie korzenia (zmiana nazwy, zmiana ceny) — jedno.</para>
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
[ClusterSafe("FOR UPDATE SKIP LOCKED na wierszu job w tej samej transakcji co wykonanie chunka — "
    + "jedno zadanie obsługuje dokładnie jeden runner, a blokada puszcza commit albo zerwana sesja.")]
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

    /// <summary>
    /// Przetwarza jeden chunk najstarszego niezakończonego zadania, którego nie trzyma inny runner.
    /// </summary>
    /// <returns><c>true</c>, jeśli coś zrobiono (warto od razu iterować dalej).</returns>
    private async Task<bool> ProcessNextChunkAsync(CancellationToken cancellationToken)
    {
        Guid jobUuid;
        List<Guid> itemUuids;

        // ── Transakcja chunka ────────────────────────────────────────────────────────────────
        // Obejmuje WYBÓR zadania i jego WYKONANIE. Rozdzielenie tych dwóch rzeczy na osobne
        // scope'y (tak było, zanim runnerów zrobiło się więcej niż jeden) jest nie do pogodzenia
        // z trzymaniem blokady: `FOR UPDATE` żyje tylko do końca swojej transakcji.
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<TContext>();

            await using var transaction = await db.Database
                .BeginTransactionAsync(cancellationToken)
                .ConfigureAwait(false);

            var queueLock = scope.ServiceProvider.GetRequiredService<JobQueueLock<TContext>>();
            var locked = await queueLock.TryLockNextAsync(db, JobKind.Map, cancellationToken).ConfigureAwait(false);

            if (locked is null)
            {
                return false;
            }

            jobUuid = locked.Value;

            var job = await db.Jobs.FirstAsync(j => j.Uuid == jobUuid, cancellationToken).ConfigureAwait(false);

            if (job.Status == JobStatus.Cancelled)
            {
                return true;
            }

            itemUuids = await db.JobItems
                .Where(i => i.JobUuid == jobUuid && i.Status == JobItemStatus.Pending)
                .OrderBy(i => i.Ordinal)
                .Take(EffectiveChunkSize(job.TotalCount))
                .Select(i => i.Uuid)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            if (itemUuids.Count == 0)
            {
                await FinishJobAsync(scope, db, job, cancellationToken).ConfigureAwait(false);
                await CommitAsync(db, cancellationToken).ConfigureAwait(false);
                return true;
            }

            var failure = await ProcessChunkAsync(scope, db, job, itemUuids, cancellationToken)
                .ConfigureAwait(false);

            if (failure is null)
            {
                return true;
            }
        }

        // Zapis chunka padł — transakcja poszła do rollbacku razem z blokadą zadania, a kontekst
        // po nieudanym `SaveChanges` jest nieużywalny. Powtarzamy element po elemencie,
        // w świeżych scope'ach, żeby odizolować winowajcę.
        LogIsolatingChunk(_logger, jobUuid, itemUuids.Count);
        await IsolateAsync(jobUuid, itemUuids, cancellationToken).ConfigureAwait(false);

        return true;
    }

    /// <summary>
    /// Powtarza elementy pojedynczo, każdy we własnej transakcji i własnym scope.
    /// </summary>
    private async Task IsolateAsync(Guid jobUuid, List<Guid> itemUuids, CancellationToken cancellationToken)
    {
        foreach (var itemUuid in itemUuids)
        {
            cancellationToken.ThrowIfCancellationRequested();

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<TContext>();

            await using var transaction = await db.Database
                .BeginTransactionAsync(cancellationToken)
                .ConfigureAwait(false);

            var queueLock = scope.ServiceProvider.GetRequiredService<JobQueueLock<TContext>>();

            // Bez SKIP LOCKED: chodzi o TO zadanie, a nie o „jakieś wolne". Jeśli w międzyczasie
            // podjął je inny runner, czekamy na jego commit i dopiero wtedy dokładamy swój wynik.
            if (await queueLock.LockAsync(db, jobUuid, cancellationToken).ConfigureAwait(false) is null)
            {
                return;
            }

            var job = await db.Jobs.FirstOrDefaultAsync(j => j.Uuid == jobUuid, cancellationToken)
                .ConfigureAwait(false);

            if (job is null || job.Status == JobStatus.Cancelled)
            {
                return;
            }

            var failure = await ProcessChunkAsync(scope, db, job, [itemUuid], cancellationToken)
                .ConfigureAwait(false);

            if (failure is not null)
            {
                // Pojedynczy element już w izolacji — dalsze dzielenie nic nie da. Trwałą porażkę
                // odnotowujemy osobnym, czystym kontekstem i pod własną blokadą zadania.
                await RecordIsolatedFailureAsync(jobUuid, itemUuid, failure, cancellationToken)
                    .ConfigureAwait(false);
            }
        }
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
    /// Wykonuje wskazane elementy zablokowanego zadania i zatwierdza transakcję wołającego.
    /// </summary>
    /// <returns><c>null</c> po udanym commicie; wyjątek zapisu, gdy trzeba wejść w tryb izolacji.</returns>
    // List<Guid> zamiast IReadOnlyList<Guid> nie jest przypadkiem: tłumaczenie `Contains`
    // na SQL przez EF Core działa wydajniej na konkretnym typie kolekcji.
    private async Task<DbUpdateException?> ProcessChunkAsync(
        IServiceScope scope,
        TContext db,
        Job job,
        List<Guid> itemUuids,
        CancellationToken cancellationToken)
    {
        var services = scope.ServiceProvider;
        var clock = services.GetRequiredService<IClock>();

        // Zadanie żyje dłużej niż żądanie HTTP, które je zleciło — odtwarzamy kontekst
        // zleceniodawcy, żeby zdarzenia i powiadomienia trafiły do właściwego użytkownika.
        if (services.GetService<IExecutionContext>() is MutableExecutionContext executionContext)
        {
            executionContext.Set(job.UserId, job.ClientId, job.CorrelationId);
        }

        // Granica transakcji należy do runnera, nie do komendy: chunk to JEDEN commit.
        // Bez tego przejęcia pipeline komend zatwierdzałby po każdym elemencie — liczniki
        // zadania i stan danych rozjechałyby się bez żadnego objawu, a wznawianie po restarcie
        // przestałoby mieć spójny punkt odniesienia.
        using var claim = services.GetRequiredService<CommandTransactionScope>().Claim();

        var executor = ResolveExecutor(services, job.CommandType);

        var items = await db.JobItems
            .Where(i => itemUuids.Contains(i.Uuid))
            .OrderBy(i => i.Ordinal)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // Agregaty całego chunka wczytujemy JEDNYM zapytaniem, zanim ruszy pętla — inaczej
        // każdy element pobiera swój osobno, a przy agregacie z kolekcjami jeszcze po jednym
        // zapytaniu na kolekcję (globalne SplitQuery). Odduplikowanie jest konieczne: tryb
        // `Commands` dopuszcza kilka różnych komend dla tego samego agregatu.
        //
        // Egzekutor, którego handler nie umie wczytywać wsadowo, nie robi tu nic — pętla niżej
        // działa wtedy dokładnie jak przedtem.
        var aggregateUuids = items.Select(i => i.AggregateUuid).Distinct().ToList();
        await executor.PreloadAsync(aggregateUuids, cancellationToken).ConfigureAwait(false);

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
            await CommitAsync(db, cancellationToken).ConfigureAwait(false);
            return null;
        }
        catch (DbUpdateException ex)
        {
            LogSaveFailed(_logger, job.Uuid, items.Count, ex);
            return ex;
        }
    }

    /// <summary>
    /// Domyka transakcję chunka, jeśli nie zrobił tego już outbox.
    ///
    /// <para><b>Dlaczego to nie jest zwykłe <c>transaction.CommitAsync()</c>.</b> Jednostka pracy
    /// deleguje zapis do <c>IIntegrationEventPublisher.SaveChangesAndFlushAsync</c>, czyli do
    /// outboxu Wolverine'a — a ten po zapisaniu kopert <b>sam zatwierdza bieżącą transakcję</b>
    /// kontekstu, bo dopiero po commicie wolno mu wypchnąć komunikaty na brokera. Jawny commit
    /// po nim trafiłby więc w transakcję, której już nie ma. Sprawdzenie
    /// <c>CurrentTransaction</c> zamiast zakładania jednego z dwóch zachowań trzyma ten kod
    /// poprawnym niezależnie od tego, po której stronie leży commit — a przy okazji obsługuje
    /// domknięcie chunka, w którym nie było nic do zapisania (zamknięcie pustego zadania).</para>
    /// </summary>
    private static async Task CommitAsync(TContext db, CancellationToken cancellationToken)
    {
        var transaction = db.Database.CurrentTransaction;

        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// Zapisuje porażkę elementu, którego nie dało się zapisać nawet w izolacji.
    /// Wymaga świeżego scope'u — kontekst po nieudanym <c>SaveChanges</c> jest nieużywalny.
    /// </summary>
    private async Task RecordIsolatedFailureAsync(
        Guid jobUuid,
        Guid itemUuid,
        DbUpdateException exception,
        CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();

        await using var transaction = await db.Database
            .BeginTransactionAsync(cancellationToken)
            .ConfigureAwait(false);

        // Licznik porażek niżej to `UPDATE` na wierszu zadania — bez blokady dwa runnery
        // odnotowujące porażki w tym samym zadaniu wpadłyby na konflikt `xmin`, czyli na
        // dokładnie ten wyjątek, który tu obsługujemy.
        var queueLock = scope.ServiceProvider.GetRequiredService<JobQueueLock<TContext>>();
        if (await queueLock.LockAsync(db, jobUuid, cancellationToken).ConfigureAwait(false) is null)
        {
            return;
        }

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
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
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

    /// <summary>
    /// Odnajduje egzekutora po nazwie typu komendy zapisanej w zadaniu.
    ///
    /// <para>Wyszukiwanie po KLUCZU, nie przez <c>GetServices&lt;IBulkCommandExecutor&gt;()</c>:
    /// tamto konstruowało wszystkie zarejestrowane egzekutory — a przez nie wszystkie handlery
    /// komend i ich repozytoria — tylko po to, żeby wybrać jeden i wyrzucić resztę. Przy ręcznych
    /// rejestracjach było ich kilkanaście i dawało się to znieść; odkąd rejestruje je skanowanie
    /// zestawu, rośnie to razem z liczbą komend modułu, a koszt płaci się przy KAŻDYM chunku.</para>
    /// </summary>
    private static IBulkCommandExecutor ResolveExecutor(IServiceProvider services, string commandType)
        => services.GetKeyedService<IBulkCommandExecutor>(commandType)
           ?? throw new InvalidOperationException(
               $"Brak zarejestrowanego {nameof(IBulkCommandExecutor)} dla komendy '{commandType}'. " +
               "Egzekutory rejestruje AddErpModule ze skanu zestawów modułu — komenda musi " +
               "implementować IAggregateCommand i ICommand<Guid> oraz mieć handler.");

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
