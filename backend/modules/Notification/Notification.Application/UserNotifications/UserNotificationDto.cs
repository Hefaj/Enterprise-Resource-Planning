using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Contracts;

namespace Notification.Application.UserNotifications;

public sealed record UserNotificationDto(
    Guid Uuid,
    string Kind,
    NotificationSeverity Severity,
    string SubjectSignature,
    Guid SubjectUuid,
    string? SubjectKey,
    string TitleKey,
    string ParamsJson,
    string Link,
    int OccurrenceCount,
    DateTimeOffset LastOccurredAt,
    DateTimeOffset? SeenAt,
    DateTimeOffset? ReadAt);

/// <summary>Pobranie wpisów skrzynki po identyfikatorach.</summary>
public sealed class GetUserNotificationRequest
{
    public List<Guid>? Uuids { get; set; }
}

/// <summary>Stronicowany feed powiadomień zalogowanego użytkownika.</summary>
public sealed class SearchUserNotificationRequest : PagedRequest { }

public interface IUserNotificationQueries
{
    Task<SearchResponse> SearchAsync(SearchUserNotificationRequest request, string userId, CancellationToken ct);
    Task<List<UserNotificationDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, string userId, CancellationToken ct);
}
