using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Catalog.Application.Warranties;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Api.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Queries;

// Trzy słownikowe agregaty katalogu. Zebrane w jednym pliku, bo każdy sprowadza się do tej
// samej pary „szukaj + pobierz po uuid" i rozbijanie ich na osobne pliki dałoby trzy niemal
// identyczne szkielety zamiast czytelnego porównania.

/// <summary>Odczyty definicji gwarancji.</summary>
public sealed class WarrantyQueries : IWarrantyQueries
{
    private readonly CatalogDbContext _dbContext;

    public WarrantyQueries(CatalogDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(
        SearchWarrantyRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.Warranties.AsNoTracking();

        if (request.WarrantyId.HasValue)
        {
            query = query.Where(w => w.Uuid == request.WarrantyId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var name = request.Name;
            query = query.Where(w => EF.Functions.ILike(w.Name, $"%{name}%"));
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var descending = request.Sorts?.FirstOrDefault()?.Order == -1;
        var ordered = descending ? query.OrderByDescending(w => w.Name) : query.OrderBy(w => w.Name);

        var uuids = await ordered
            .ThenBy(w => w.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(w => w.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<WarrantyDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Warranties.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(w => uuidList.Contains(w.Uuid));
        }

        return await query
            .Select(w => new WarrantyDto(w.Uuid, w.Name, w.DurationMonths, w.Description))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
