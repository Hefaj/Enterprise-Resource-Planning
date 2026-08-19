using FastEndpoints;

namespace Identity.Audit;

public class AuditGroup : Group
{
    public AuditGroup()
    {
        Configure("grant-audit", ep =>
        {
        });
    }
}
