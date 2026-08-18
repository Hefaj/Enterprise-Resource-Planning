using FastEndpoints;

namespace Notification.Jobs;

public class JobGroup : Group
{
    public JobGroup()
    {
        Configure("job", ep =>
        {
        });
    }
}
