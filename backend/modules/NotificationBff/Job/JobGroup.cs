using FastEndpoints;

namespace NotificationBff.Job;

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
