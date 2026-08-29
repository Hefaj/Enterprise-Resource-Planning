using FastEndpoints;

namespace Notification.UserNotifications;

public sealed class UserNotificationGroup : Group
{
    public UserNotificationGroup()
    {
        Configure("user-notification", _ => { });
    }
}
