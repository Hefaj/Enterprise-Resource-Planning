using FastEndpoints;

namespace Catalog.Category;

public class CategoryGroup : Group
{
    public CategoryGroup()
    {
        Configure("category", ep =>
        {
            ep.AllowAnonymous();
        });
    }
}
