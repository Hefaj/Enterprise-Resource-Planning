using FastEndpoints;

namespace Catalog.Model;

public class ModelGroup : Group
{
    public ModelGroup()
    {
        Configure("model", ep =>
        {
            ep.AllowAnonymous();
            // Tutaj możesz dodać wspólne ustawienia dla całej grupy, 
            // np. polityki autoryzacji czy opisy Swaggera
        });
    }
}
