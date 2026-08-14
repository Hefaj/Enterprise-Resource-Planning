using FastEndpoints;

namespace Sales.Customer;

public class CustomerGroup : Group
{
    public CustomerGroup()
    {
        Configure("customer", ep =>
        {
            ep.AllowAnonymous();
        });
    }
}
