namespace Erp.BuildingBlocks.Contracts;

/// <summary>Poziom istotności powiadomienia adresowanego do użytkownika.</summary>
public enum NotificationSeverity
{
    Info = 0,
    Warning = 1,
    Critical = 2,
}

/// <summary>Potwierdzenie zapisu powiadomienia do skrzynki konkretnego użytkownika.
/// Osobny kontrakt umożliwia warstwie API rozgłoszenie SignalR dopiero po zatwierdzeniu
/// trwałego wpisu przez konsumenta.</summary>
public sealed record UserNotificationDelivered(
    Guid NotificationUuid,
    Guid UserUuid,
    int UnreadCount);

/// <summary>
/// Żądanie utworzenia powiadomienia użytkownika. Producent ustala odbiorców i świadomie
/// przekazuje wyłącznie dane bezpieczne do pokazania poza własnym modelem dostępu.
/// </summary>
public sealed record UserNotificationRequested(
    IReadOnlyList<Guid> Recipients,
    Guid? ActorId,
    string Kind,
    string SubjectSignature,
    Guid SubjectUuid,
    string? SubjectKey,
    string TitleKey,
    IReadOnlyDictionary<string, string> Params,
    string? GroupKey,
    string Link,
    NotificationSeverity Severity,
    Guid CorrelationId,
    DateTimeOffset OccurredAt);
