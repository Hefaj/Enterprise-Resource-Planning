using FastEndpoints;

namespace Sales.Customers;

public class CustomerGroup : Group
{
    public CustomerGroup()
    {
        Configure("customer", ep =>
        {
        });
    }
}
