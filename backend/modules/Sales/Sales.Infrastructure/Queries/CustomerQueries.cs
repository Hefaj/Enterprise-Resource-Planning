using Erp.BuildingBlocks.Api.Contracts;
using Microsoft.EntityFrameworkCore;
using Sales.Application.Contracts;
using Sales.Infrastructure.Persistence;

namespace Sales.Infrastructure.Queries;

/// <summary>Odczyty klientów, bezpośrednio na EF Core — patrz wzorzec w
/// <c>Catalog.Infrastructure.Queries.ProductQueries</c>.</summary>
public sealed class CustomerQueries : ICustomerQueries
{
    private readonly SalesDbContext _dbContext;

    public CustomerQueries(SalesDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(SearchCustomerRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.Customers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var name = request.Name;
            query = query.Where(c => EF.Functions.ILike(c.Name, $"%{name}%"));
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await query
            .OrderBy(c => c.Name)
            .ThenBy(c => c.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(c => c.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<Guid>> GetMatchingUuidsAsync(
        SearchCustomerRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.Customers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var name = request.Name;
            query = query.Where(c => EF.Functions.ILike(c.Name, $"%{name}%"));
        }

        return await query
            .OrderBy(c => c.Uuid)
            .Select(c => c.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<List<CustomerDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Customers.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(c => uuidList.Contains(c.Uuid));
        }

        return await query
            .Select(c => new CustomerDto(c.Uuid, c.Name, c.Email))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
