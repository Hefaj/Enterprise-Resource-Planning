using FastEndpoints;

namespace Notification.Job;

public class JobGroup : Group
{
    public JobGroup()
    {
        Configure("job", ep =>
        {
            ep.AllowAnonymous();
        });
    }
}
