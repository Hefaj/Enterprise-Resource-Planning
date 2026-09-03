using FastEndpoints;

namespace TaskManagement.Webhooks;

/// <summary>Prefiks tras webhooków wychodzących.</summary>
public class WebhookGroup : Group
{
    public WebhookGroup()
    {
        Configure("webhook", ep =>
        {
        });
    }
}
