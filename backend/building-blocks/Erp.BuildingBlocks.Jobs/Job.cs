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
        Status = JobStatus.Pending;
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

    /// <summary>Tworzy zadanie wraz z elementami dla podanych agregatów.</summary>
    public static Job Create(
        string commandType,
        string? commandJson,
        IReadOnlyList<Guid> targetUuids,
        string? queueId,
        string? userId,
        string? clientId,
        Guid correlationId,
        string? uiMetadata,
        DateTimeOffset createdAt,
        DateTimeOffset? expireOn = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(commandType);
        ArgumentNullException.ThrowIfNull(targetUuids);

        if (targetUuids.Count == 0)
        {
            throw new DomainException("job_empty", "Zadanie masowe musi obejmować co najmniej jeden element.");
        }

        var job = new Job(
            NewUuid(), commandType, commandJson, queueId, userId, clientId,
            correlationId, uiMetadata, createdAt, expireOn);

        var ordinal = 0;
        foreach (var targetUuid in targetUuids)
        {
            job._items.Add(JobItem.Create(job.Uuid, targetUuid, ordinal++));
        }

        job.TotalCount = job._items.Count;
        return job;
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
