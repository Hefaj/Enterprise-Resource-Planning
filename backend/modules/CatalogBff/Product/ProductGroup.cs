using FastEndpoints;

namespace CatalogBff.Product;
public class ProductGroup : Group
{
    public ProductGroup()
    {
        Configure("product", ep =>
        {
            ep.AllowAnonymous();
            // Tutaj możesz dodać wspólne ustawienia dla całej grupy, 
            // np. polityki autoryzacji czy opisy Swaggera
        });
    }
}