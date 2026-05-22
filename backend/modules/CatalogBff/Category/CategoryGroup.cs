using FastEndpoints;

namespace CatalogBff.Category;

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
