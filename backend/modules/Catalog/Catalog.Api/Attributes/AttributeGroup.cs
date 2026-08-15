using FastEndpoints;

namespace Catalog.Attributes;

public class AttributeGroup : Group
{
    public AttributeGroup()
    {
        Configure("attribute", ep =>
        {
            ep.AllowAnonymous();
        });
    }
}
