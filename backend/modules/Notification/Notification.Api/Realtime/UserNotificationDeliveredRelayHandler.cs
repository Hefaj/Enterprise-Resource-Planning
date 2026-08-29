using Erp.BuildingBlocks.Contracts;
using Microsoft.AspNetCore.SignalR;
using Notification.Api.Hubs;

namespace Notification.Api.Realtime;

/// <summary>Adresowany push do dzwonka po trwałym zapisie wpisu w skrzynce.</summary>
public sealed class UserNotificationDeliveredRelayHandler
{
    public static Task Handle(UserNotificationDelivered message, IHubContext<SyncHub> hub) =>
        hub.Clients.Group(GroupNames.ForUser(message.UserUuid.ToString("D")))
            .SendAsync("ReceiveNotification", message.NotificationUuid.ToString("D"), message.UnreadCount);
}
