using Erp.BuildingBlocks.Contracts;

namespace Notification.Application.UserNotifications;

/// <summary>Wiersz feedu do wyświetlenia — <c>Params</c> jest już zdeserializowane, front
/// podstawia je w tłumaczeniu klucza <c>TitleKey</c> (scope <c>shared</c>, przestrzeń
/// <c>shared.notifications.kinds.*</c>).</summary>
public sealed record UserNotificationDto(
    Guid Uuid,
    string? ActorId,
    string Kind,
    NotificationSeverity Severity,
    string SubjectSignature,
    Guid SubjectUuid,
    string? SubjectKey,
    string TitleKey,
    IReadOnlyDictionary<string, string> Params,
    string? GroupKey,
    int OccurrenceCount,
    DateTimeOffset LastOccurredAt,
    string Link,
    DateTimeOffset CreatedAt,
    DateTimeOffset? SeenAt,
    DateTimeOffset? ReadAt);
