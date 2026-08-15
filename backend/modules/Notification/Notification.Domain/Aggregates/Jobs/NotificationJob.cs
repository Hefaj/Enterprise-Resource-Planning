using Erp.BuildingBlocks.Domain;

namespace Notification.Domain.Jobs;

/// <summary>
/// Read-model — replika zadania masowego wykonywanego przez serwis będący jego właścicielem
/// (np. Catalog). Notification nigdy nie wykonuje ani nie tworzy zadań; ta encja istnieje
/// wyłącznie po to, by <c>searchJob</c>/<c>getJob</c> mogły odpowiadać bez odpytywania serwisu
/// wykonującego przy każdym żądaniu, i bez łamania granicy modułu joinem cross-schema.
///
/// Zasilana wyłącznie zdarzeniami integracyjnymi <c>JobAccepted</c>/<c>JobProgressed</c>/
/// <c>JobCompleted</c> (patrz <c>Notification.Infrastructure/Consumers</c>) — nigdy komendą
/// użytkownika. Dlatego, w przeciwieństwie do typowego agregatu, nie ma tu reguł biznesowych
/// do naruszenia: metody tej klasy tylko projektują fakt, który już zaszedł gdzie indziej.
///
/// Mimo to jest zarejestrowana jako agregat w <c>IAggregateSignatureMap</c>
/// (<see cref="Erp.BuildingBlocks.Contracts.AggregateSignatures.NotificationJob"/>) — dzięki temu
/// każda aktualizacja repliki automatycznie generuje <c>AggregateChanged</c> ze skanu
/// ChangeTrackera, dokładnie tak samo jak dla „prawdziwych” agregatów biznesowych.
/// </summary>
public class NotificationJob : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected NotificationJob()
    {
    }

    private NotificationJob(
        Guid uuid,
        string? queueId,
        string commandType,
        string? commandJson,
        int totalCount,
        string? userId,
        string? clientId,
        string? uiMetadata,
        DateTimeOffset createdAt,
        DateTimeOffset? expireOn) : base(uuid)
    {
        QueueId = queueId;
        TrackingId = uuid.ToString();
        CommandType = commandType;
        CommandJson = commandJson;
        TotalCount = totalCount;
        UserId = userId;
        ClientId = clientId;
        UiMetadata = uiMetadata;
        CreatedAt = createdAt;
        ExpireOn = expireOn;
    }

    public string? QueueId { get; private set; }

    /// <summary>
    /// Kopia <c>Uuid</c> jako tekst, utrwalona jawnie zamiast liczona w locie.
    ///
    /// Kontrakt <c>SearchJobRequest.TrackingId</c> jest wyszukiwaniem <i>częściowym</i>
    /// (ILIKE „zawiera”), a nie dopasowaniem dokładnym — dlatego nie da się go sprowadzić
    /// do filtra po <c>Uuid</c>. Osobna, indeksowana kolumna tekstowa jest prostsza i pewniejsza
    /// niż poleganie na tłumaczeniu <c>Guid.ToString()</c> na SQL przez dostawcę EF.
    /// </summary>
    public string TrackingId { get; private set; } = string.Empty;

    public string CommandType { get; private set; } = string.Empty;

    /// <summary>Payload komendy-szablonu z chwili przyjęcia zadania.</summary>
    public string? CommandJson { get; private set; }

    public int TotalCount { get; private set; }

    public int SucceededCount { get; private set; }

    public int FailedCount { get; private set; }

    public bool IsComplete { get; private set; }

    /// <summary>
    /// Podsumowanie błędów zgrupowane po kodzie (patrz <c>JobCompleted.ErrorsSummary</c>),
    /// nie lista komunikatów per element — te zostają w <c>job_item</c> u właściciela zadania.
    /// </summary>
    public string? ErrorsSummary { get; private set; }

    public string? UserId { get; private set; }

    public string? ClientId { get; private set; }

    public string? UiMetadata { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? ExpireOn { get; private set; }

    /// <summary>Materializuje wpis repliki z <c>JobAccepted</c>.</summary>
    public static NotificationJob CreateFromAccepted(
        Guid jobUuid,
        string? queueId,
        string commandType,
        string? commandJson,
        int totalCount,
        string? userId,
        string? clientId,
        string? uiMetadata,
        DateTimeOffset createdAt,
        DateTimeOffset? expireOn)
        => new(jobUuid, queueId, commandType, commandJson, totalCount, userId, clientId, uiMetadata, createdAt, expireOn);

    /// <summary>Aktualizuje liczniki na podstawie <c>JobProgressed</c> — wartości są kumulatywne,
    /// nie przyrostowe, więc po prostu podmieniamy stan.</summary>
    public void ApplyProgress(int succeeded, int failed)
    {
        SucceededCount = succeeded;
        FailedCount = failed;
    }

    /// <summary>Zamyka replikę na podstawie <c>JobCompleted</c>.</summary>
    public void ApplyCompletion(int succeeded, int failed, string? errorsSummary)
    {
        SucceededCount = succeeded;
        FailedCount = failed;
        ErrorsSummary = errorsSummary;
        IsComplete = true;
    }
}
