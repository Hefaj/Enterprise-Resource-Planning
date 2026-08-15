using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Catalog.Application.Contracts;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Api.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Queries;

// Trzy słownikowe agregaty katalogu. Zebrane w jednym pliku, bo każdy sprowadza się do tej
// samej pary „szukaj + pobierz po uuid" i rozbijanie ich na osobne pliki dałoby trzy niemal
// identyczne szkielety zamiast czytelnego porównania.

/// <summary>Odczyty modeli produktów.</summary>
public sealed class ModelQueries : IModelQueries
{
    private readonly CatalogDbContext _dbContext;

    public ModelQueries(CatalogDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(
        SearchModelRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.ProductModels.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var name = request.Name;
            query = query.Where(m => EF.Functions.ILike(m.Name, $"%{name}%"));
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var descending = request.Sorts?.FirstOrDefault()?.Order == -1;
        var ordered = descending ? query.OrderByDescending(m => m.Name) : query.OrderBy(m => m.Name);

        var uuids = await ordered
            .ThenBy(m => m.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(m => m.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<ModelDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.ProductModels.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(m => uuidList.Contains(m.Uuid));
        }

        return await query
            .Select(m => new ModelDto(m.Uuid, m.Name))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
