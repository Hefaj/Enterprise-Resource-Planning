using FastEndpoints;

namespace Notification.UserNotifications;

public class UserNotificationGroup : Group
{
    public UserNotificationGroup()
    {
        Configure("user-notification", ep =>
        {
        });
    }
}
