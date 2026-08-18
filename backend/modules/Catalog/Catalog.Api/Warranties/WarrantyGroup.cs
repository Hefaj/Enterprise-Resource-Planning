using FastEndpoints;

namespace Catalog.Warranties;

public class WarrantyGroup : Group
{
    public WarrantyGroup()
    {
        Configure("warranty", ep =>
        {
        });
    }
}
