using FastEndpoints;

namespace Catalog.Products;

public class ProductGroup : Group
{
    public ProductGroup()
    {
        Configure("product", ep =>
        {
            // Tutaj możesz dodać wspólne ustawienia dla całej grupy, 
            // np. polityki autoryzacji czy opisy Swaggera
        });
    }
}
