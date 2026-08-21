using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Domain;

namespace Erp.BuildingBlocks.Jobs;

/// <summary>
/// Zadanie masowe — trwały ślad operacji zbiorczej zleconej przez użytkownika.
///
/// Istnieje w bazie, a nie w pamięci procesu, i to jest jego główna racja bytu. Poprzednia
/// implementacja (<c>BatchEndpointBase</c> + <c>Channel&lt;T&gt;</c>) traciła całą kolejkę przy
/// restarcie i zwracała na front <c>jobUuid</c>, za którym nie stało nic — użytkownik widział
/// „zadanie w toku”, którego backend już nie znał. Tutaj restart procesu jest nieszkodliwy:
/// runner wznawia od pierwszego niedokończonego <see cref="JobItem"/>.
///
/// Właścicielem zadania jest serwis, który je wykonuje (np. Catalog). Notification trzyma
/// wyłącznie replikę do odczytu, zasilaną zdarzeniami <see cref="JobAccepted"/>,
/// <see cref="JobProgressed"/> i <see cref="JobCompleted"/>.
/// </summary>
public class Job : AggregateRoot
{
    private readonly List<JobItem> _items = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    protected Job()
    {
    }

    private Job(
        Guid uuid,
        string commandType,
        string? commandJson,
        string? queueId,
        string? userId,
        string? clientId,
        Guid correlationId,
        string? uiMetadata,
        DateTimeOffset createdAt,
        DateTimeOffset? expireOn) : base(uuid)
    {
        CommandType = commandType;
        CommandJson = commandJson;
        QueueId = queueId;
        UserId = userId;
        ClientId = clientId;
        CorrelationId = correlationId;
        UiMetadata = uiMetadata;
        CreatedAt = createdAt;
        ExpireOn = expireOn;

        // Zadanie rodzi się jako szkic i staje się widoczne dopiero przez MarkAccepted —
        // patrz uzasadnienie tam i przy JobStatus.Draft.
        Status = JobStatus.Draft;
    }

    /// <summary>Nazwa typu komendy wykonywanej dla każdego elementu — po niej runner
    /// odnajduje właściwy <see cref="IBulkCommandExecutor"/>.</summary>
    public string CommandType { get; private set; } = string.Empty;

    /// <summary>Serializowana komenda-szablon (bez <c>Uuid</c>, który jest per element).</summary>
    public string? CommandJson { get; private set; }

    /// <summary>Identyfikator wywołującego (zwykle modalu) — frontend grupuje po nim zadania.</summary>
    public string? QueueId { get; private set; }

    /// <summary>Zleceniodawca — decyduje o adresacie powiadomień SignalR.</summary>
    public string? UserId { get; private set; }

    /// <summary>Klient/połączenie, jeśli znane.</summary>
    public string? ClientId { get; private set; }

    /// <summary>Korelacja z pierwotnym żądaniem HTTP.</summary>
    public Guid CorrelationId { get; private set; }

    /// <summary>Nieprzezroczysty dla backendu blob z frontendu.</summary>
    public string? UiMetadata { get; private set; }

    public JobStatus Status { get; private set; }

    public int TotalCount { get; private set; }

    public int SucceededCount { get; private set; }

    public int FailedCount { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? StartedAt { get; private set; }

    public DateTimeOffset? FinishedAt { get; private set; }

    public DateTimeOffset? ExpireOn { get; private set; }

    /// <summary>Elementy zadania. Kolekcja jest częścią agregatu, ale przy dużych zadaniach
    /// NIE ładuje się jej w całości — runner pobiera je porcjami zapytaniem po statusie.</summary>
    public IReadOnlyCollection<JobItem> Items => _items.AsReadOnly();

    /// <summary>Liczba elementów jeszcze nieprzetworzonych.</summary>
    public int RemainingCount => TotalCount - SucceededCount - FailedCount;

    /// <summary>
    /// Tworzy zadanie wraz z elementami.
    ///
    /// Każdy cel może nieść własny payload komendy (tryb <c>Commands</c> z listą różnych komend)
    /// albo <c>null</c> — wtedy element użyje szablonu <paramref name="commandJson"/>.
    /// </summary>
    /// <param name="commandType">Nazwa typu komendy wykonywanej dla każdego elementu.</param>
    /// <param name="commandJson">Serializowana komenda-szablon, jeśli tryb jej używa.</param>
    /// <param name="targets">Elementy zadania.</param>
    /// <param name="queueId">Identyfikator wywołującego, po którym frontend grupuje zadania.</param>
    /// <param name="userId">Zleceniodawca — decyduje o adresacie powiadomień SignalR.</param>
    /// <param name="clientId">Klient/połączenie, jeśli znane.</param>
    /// <param name="correlationId">Korelacja z pierwotnym żądaniem HTTP.</param>
    /// <param name="uiMetadata">Nieprzezroczysty dla backendu blob z frontendu.</param>
    /// <param name="createdAt">Znacznik czasu utworzenia.</param>
    /// <param name="expireOn">Opcjonalny czas wygaśnięcia zadania.</param>
    /// <param name="preValidatedFailures">
    /// Elementy odrzucone jeszcze PRZED utworzeniem zadania (np. przez walidację wsadową
    /// z <c>Erp.BuildingBlocks.Validation</c>) — trafiają od razu do stanu
    /// <see cref="JobItemStatus.Failed"/>, więc nigdy nie zostają podjęte przez
    /// <c>BulkCommandRunner</c>. Runner nie wymaga żadnej zmiany: element bez statusu
    /// <c>Pending</c> po prostu nie pojawi się w jego zapytaniu o kolejny chunk, a zadanie,
    /// w którym WSZYSTKIE elementy trafiły tutaj, zostanie zamknięte przy najbliższym przebiegu
    /// pętli (<c>RemainingCount == 0</c> od razu po utworzeniu).
    /// </param>
    public static Job Create(
        string commandType,
        string? commandJson,
        IReadOnlyList<JobTarget> targets,
        string? queueId,
        string? userId,
        string? clientId,
        Guid correlationId,
        string? uiMetadata,
        DateTimeOffset createdAt,
        DateTimeOffset? expireOn = null,
        IReadOnlyDictionary<Guid, (string ErrorCode, string ErrorMessage)>? preValidatedFailures = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(commandType);
        ArgumentNullException.ThrowIfNull(targets);

        if (targets.Count == 0)
        {
            throw new DomainException("job_empty", "Zadanie masowe musi obejmować co najmniej jeden element.");
        }

        var job = new Job(
            NewUuid(), commandType, commandJson, queueId, userId, clientId,
            correlationId, uiMetadata, createdAt, expireOn);

        var ordinal = 0;
        foreach (var target in targets)
        {
            var item = JobItem.Create(job.Uuid, target.AggregateUuid, ordinal++, target.CommandJson);
            job._items.Add(item);

            if (preValidatedFailures is not null
                && preValidatedFailures.TryGetValue(target.AggregateUuid, out var failure))
            {
                // maxAttempts: 1 — to nie jest błąd przejściowy do ponowienia, tylko ostateczne
                // odrzucenie sprzed startu zadania; element ma od razu trafić w stan końcowy.
                item.MarkFailed(failure.ErrorCode, failure.ErrorMessage, maxAttempts: 1, createdAt);
            }
        }

        job.TotalCount = job._items.Count;
        job.FailedCount = job._items.Count(i => i.Status == JobItemStatus.Failed);
        return job;
    }

    /// <summary>
    /// Kończy zakładanie zadania: ze szkicu (<see cref="JobStatus.Draft"/>) robi zadanie
    /// oczekujące, które runner może podjąć.
    ///
    /// <para>To przełączenie jest JEDYNYM momentem, w którym zadanie staje się faktem — musi
    /// zostać zatwierdzone w tej samej transakcji co koperta <see cref="JobAccepted"/>. Dopóki
    /// się nie powiedzie, nie istnieje ani dla runnera (jego zapytanie bierze tylko
    /// <see cref="JobStatus.Pending"/> i <see cref="JobStatus.Running"/>), ani dla klienta
    /// (nie dostał jeszcze <c>jobUuid</c>), ani dla Notification (koperta nie wyszła).</para>
    /// </summary>
    /// <exception cref="DomainException">Gdy zadanie nie jest już szkicem — podwójne przyjęcie
    /// oznaczałoby drugą kopertę <see cref="JobAccepted"/> dla tego samego zadania.</exception>
    public void MarkAccepted()
    {
        if (Status != JobStatus.Draft)
        {
            throw new DomainException(
                "job_already_accepted",
                "Zadanie zostało już przyjęte — tylko szkic można przyjąć.");
        }

        Status = JobStatus.Pending;
    }

    /// <summary>Oznacza rozpoczęcie przetwarzania (przy pierwszym chunku).</summary>
    public void MarkStarted(DateTimeOffset startedAt)
    {
        if (Status != JobStatus.Pending)
        {
            return;
        }

        Status = JobStatus.Running;
        StartedAt = startedAt;
    }

    /// <summary>Dolicza wynik zatwierdzonego chunka do liczników.</summary>
    public void RecordChunkResult(int succeeded, int failed)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(succeeded);
        ArgumentOutOfRangeException.ThrowIfNegative(failed);

        SucceededCount += succeeded;
        FailedCount += failed;
    }

    /// <summary>Zamyka zadanie, wybierając status końcowy na podstawie liczników.
    /// Sukces częściowy jest dozwolony i ma własny status — użytkownik musi odróżnić
    /// „zrobione” od „zrobione, ale 1200 pozycji odpadło”.</summary>
    public void Complete(DateTimeOffset finishedAt)
    {
        if (Status is JobStatus.Completed or JobStatus.CompletedWithErrors or JobStatus.Cancelled or JobStatus.Failed)
        {
            return;
        }

        Status = FailedCount switch
        {
            0 => JobStatus.Completed,
            _ when SucceededCount == 0 => JobStatus.Failed,
            _ => JobStatus.CompletedWithErrors,
        };

        FinishedAt = finishedAt;
    }

    /// <summary>Anuluje zadanie. Runner sprawdza status przed każdym chunkiem, więc elementy
    /// już przetworzone zostają — anulowanie zatrzymuje pracę, nie cofa jej.</summary>
    public void Cancel(DateTimeOffset cancelledAt)
    {
        if (Status is JobStatus.Completed or JobStatus.CompletedWithErrors or JobStatus.Failed)
        {
            throw new DomainException("job_already_finished", "Nie można anulować zakończonego zadania.");
        }

        Status = JobStatus.Cancelled;
        FinishedAt = cancelledAt;
    }
}
