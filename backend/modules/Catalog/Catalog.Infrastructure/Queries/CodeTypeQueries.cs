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

/// <summary>Odczyty słownika typów kodów.</summary>
public sealed class CodeTypeQueries : ICodeTypeQueries
{
    private readonly CatalogDbContext _dbContext;

    public CodeTypeQueries(CatalogDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(
        SearchCodeTypeRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.CodeTypes.AsNoTracking();

        if (request.CodeTypeId.HasValue)
        {
            query = query.Where(t => t.Uuid == request.CodeTypeId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var name = request.Name;
            query = query.Where(t => EF.Functions.ILike(t.Name, $"%{name}%")
                                  || EF.Functions.ILike(t.Symbol, $"%{name}%"));
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var descending = request.Sorts?.FirstOrDefault()?.Order == -1;
        var ordered = descending
            ? query.OrderByDescending(t => t.SortOrder).ThenByDescending(t => t.Symbol)
            : query.OrderBy(t => t.SortOrder).ThenBy(t => t.Symbol);

        var uuids = await ordered
            .ThenBy(t => t.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(t => t.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<CodeTypeDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.CodeTypes.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(t => uuidList.Contains(t.Uuid));
        }

        return await query
            .Select(t => new CodeTypeDto(t.Uuid, t.Symbol, t.Name, t.Pattern, t.IsUnique, t.SortOrder))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
