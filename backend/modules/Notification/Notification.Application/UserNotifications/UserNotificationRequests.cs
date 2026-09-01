using Erp.BuildingBlocks.Api.Contracts;

namespace Notification.Application.UserNotifications;

/// <summary>Filtry feedu — jak w <c>SearchJobRequest</c>, bez pola właściciela: ten bierze
/// endpoint z <c>IExecutionContext</c>, nigdy z ciała żądania.</summary>
public sealed class SearchUserNotificationRequest : PagedRequest
{
    /// <summary>Zawęża do nieprzeczytanych — widok domyślny popovera dzwonka.</summary>
    public bool? OnlyUnread { get; set; }
}

public sealed class SearchUserNotificationResponse
{
    public List<UserNotificationDto> Items { get; set; } = [];

    public int TotalCount { get; set; }
}

public sealed class GetUnreadCountResponse
{
    public int Count { get; set; }
}

public sealed class SetNotificationReadRequest
{
    public Guid Uuid { get; set; }
}
