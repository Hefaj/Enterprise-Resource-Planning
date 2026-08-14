using Sales.Domain.Customers;

namespace Sales.Application.Abstractions;

/// <summary>Dostęp do agregatu <see cref="Customer"/> po stronie zapisu —
/// patrz uzasadnienie przy <c>Catalog.Application.Abstractions.IProductRepository</c>.</summary>
public interface ICustomerRepository
{
    Task<Customer?> FindAsync(Guid uuid, CancellationToken cancellationToken);

    void Add(Customer customer);
}
