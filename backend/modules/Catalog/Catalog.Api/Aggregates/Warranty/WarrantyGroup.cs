using FastEndpoints;

namespace Catalog.Warranty;

public class WarrantyGroup : Group
{
    public WarrantyGroup()
    {
        Configure("warranty", ep =>
        {
            ep.AllowAnonymous();
        });
    }
}
