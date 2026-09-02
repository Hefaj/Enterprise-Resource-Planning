using System.Linq.Expressions;
using Catalog.Application.ReportRuns;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Queries;

/// <summary>Odczyty przebiegów raportu, bezpośrednio na EF Core.</summary>
public sealed class ReportRunQueries : IReportRunQueries
{
    private readonly CatalogDbContext _dbContext;

    public ReportRunQueries(CatalogDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    private static Expression<Func<ReportRun, ReportRunDto>> Projection
        => r => new ReportRunDto(
            r.Uuid,
            r.ReportKey,
            r.Format,
            r.Status,
            r.JobUuid,
            r.ArtifactUuid,
            r.RecordCount,
            r.ErrorCode,
            r.CreatedAt,
            r.FinishedAt,
            r.ExpireOn);

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(
        SearchReportRunRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.ReportRuns.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.ReportKey))
        {
            var reportKey = request.ReportKey;
            query = query.Where(r => r.ReportKey == reportKey);
        }

        if (!string.IsNullOrWhiteSpace(request.Format))
        {
            var format = request.Format.ToLowerInvariant();
            query = query.Where(r => r.Format == format);
        }

        if (request.Status.HasValue)
        {
            query = query.Where(r => r.Status == request.Status.Value);
        }

        // Count PRZED stronicowaniem — totalCount opisuje cały zbiór wyników, nie stronę.
        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await ApplySorting(query, request)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(r => r.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<ReportRunDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.ReportRuns.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(r => uuidList.Contains(r.Uuid));
        }

        return await query.Select(Projection).ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Sortowanie po whiteliście, nigdy po nazwie pola z żądania.</summary>
    private static IQueryable<ReportRun> ApplySorting(IQueryable<ReportRun> query, SearchReportRunRequest request)
    {
        if (request.Sorts is null || request.Sorts.Count == 0)
        {
            return query.OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Uuid);
        }

        IOrderedQueryable<ReportRun>? ordered = null;

        foreach (var sort in request.Sorts)
        {
            var descending = sort.Order == -1;

            ordered = sort.Field.ToUpperInvariant() switch
            {
                "REPORTKEY" => Chain(ordered, query, r => r.ReportKey, descending),
                "FORMAT" => Chain(ordered, query, r => r.Format, descending),
                "STATUS" => Chain(ordered, query, r => r.Status, descending),
                "CREATEDAT" => Chain(ordered, query, r => r.CreatedAt, descending),
                "FINISHEDAT" => Chain(ordered, query, r => r.FinishedAt, descending),
                _ => ordered,
            };
        }

        // Stabilne domknięcie: bez niego Postgres nie gwarantuje kolejności wierszy
        // o równych kluczach, więc ten sam przebieg potrafi się powtórzyć na dwóch stronach.
        return ordered is null
            ? query.OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Uuid)
            : ordered.ThenBy(r => r.Uuid);
    }

    private static IOrderedQueryable<ReportRun> Chain<TKey>(
        IOrderedQueryable<ReportRun>? ordered,
        IQueryable<ReportRun> query,
        Expression<Func<ReportRun, TKey>> selector,
        bool descending)
    {
        if (ordered is null)
        {
            return descending ? query.OrderByDescending(selector) : query.OrderBy(selector);
        }

        return descending ? ordered.ThenByDescending(selector) : ordered.ThenBy(selector);
    }
}
