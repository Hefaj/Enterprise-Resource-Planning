using Microsoft.EntityFrameworkCore;
using Sales.Application.Abstractions;
using Sales.Domain.Customers;
using Sales.Infrastructure.Persistence;

namespace Sales.Infrastructure.Repositories;

/// <summary>Repozytorium klientów oparte na EF Core.</summary>
public sealed class CustomerRepository : ICustomerRepository
{
    private readonly SalesDbContext _dbContext;

    public CustomerRepository(SalesDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<Customer?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.Customers.FirstOrDefaultAsync(c => c.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(Customer customer) => _dbContext.Customers.Add(customer);
}
