using FastEndpoints;

namespace Identity.IntegrationClients;

public class IntegrationClientGroup : Group
{
    public IntegrationClientGroup()
    {
        Configure("integration-client", ep =>
        {
        });
    }
}
