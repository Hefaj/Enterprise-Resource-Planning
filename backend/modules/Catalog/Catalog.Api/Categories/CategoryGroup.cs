using FastEndpoints;

namespace Catalog.Categories;

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
