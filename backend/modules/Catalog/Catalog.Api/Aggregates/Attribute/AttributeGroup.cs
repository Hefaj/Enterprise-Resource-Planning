using FastEndpoints;

namespace Catalog.Attribute;

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
