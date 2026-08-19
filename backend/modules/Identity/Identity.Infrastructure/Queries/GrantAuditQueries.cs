using System.Linq.Expressions;
using Erp.BuildingBlocks.Api.Contracts;
using Identity.Application.Audit;
using Identity.Domain.Audit;
using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Identity.Infrastructure.Queries;

/// <inheritdoc cref="IGrantAuditQueries" />
public sealed class GrantAuditQueries : IGrantAuditQueries
{
    private readonly IdentityDbContext _dbContext;

    public GrantAuditQueries(IdentityDbContext dbContext) => _dbContext = dbContext;

    public async Task<SearchResponse> SearchAsync(SearchGrantAuditRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.GrantAuditEntries.AsNoTracking();

        if (request.SubjectUuid is { } subjectUuid)
        {
            query = query.Where(e => e.SubjectUuid == subjectUuid);
        }

        if (!string.IsNullOrWhiteSpace(request.SubjectType))
        {
            var subjectType = request.SubjectType;
            query = query.Where(e => e.SubjectType == subjectType);
        }

        if (!string.IsNullOrWhiteSpace(request.Action))
        {
            var action = request.Action;
            query = query.Where(e => e.Action == action);
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await ApplySorting(query, request)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(e => e.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <summary>Sortowanie po polach dopuszczonych przez kontrakt — whitelist, nie dynamiczne
    /// wyrażenie z nazwy pola żądania (patrz uzasadnienie w <c>Catalog ProductQueries</c>).
    /// <c>SubjectUuid</c>/<c>SubjectType</c> pomijamy: kolumna "subject" na froncie łączy oba
    /// pola w jeden tekst, więc nie odpowiada pojedynczej kolumnie do posortowania.</summary>
    private static IQueryable<GrantAuditEntry> ApplySorting(IQueryable<GrantAuditEntry> query, SearchGrantAuditRequest request)
    {
        if (request.Sorts is null || request.Sorts.Count == 0)
        {
            return query.OrderByDescending(e => e.OccurredAt).ThenBy(e => e.Uuid);
        }

        IOrderedQueryable<GrantAuditEntry>? ordered = null;

        foreach (var sort in request.Sorts)
        {
            var descending = sort.Order == -1;

            ordered = sort.Field.ToUpperInvariant() switch
            {
                "OCCURREDAT" => Chain(ordered, query, e => e.OccurredAt, descending),
                "ACTORUSERUUID" => Chain(ordered, query, e => e.ActorUserUuid, descending),
                "ACTION" => Chain(ordered, query, e => e.Action, descending),
                "TARGETCODE" => Chain(ordered, query, e => e.TargetCode, descending),
                "SOURCE" => Chain(ordered, query, e => e.Source, descending),
                _ => ordered,
            };
        }

        return ordered is null
            ? query.OrderByDescending(e => e.OccurredAt).ThenBy(e => e.Uuid)
            : ordered.ThenBy(e => e.Uuid);
    }

    private static IOrderedQueryable<GrantAuditEntry> Chain<TKey>(
        IOrderedQueryable<GrantAuditEntry>? ordered,
        IQueryable<GrantAuditEntry> query,
        Expression<Func<GrantAuditEntry, TKey>> selector,
        bool descending)
    {
        if (ordered is null)
        {
            return descending ? query.OrderByDescending(selector) : query.OrderBy(selector);
        }

        return descending ? ordered.ThenByDescending(selector) : ordered.ThenBy(selector);
    }

    public async Task<List<GrantAuditDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken)
    {
        var query = _dbContext.GrantAuditEntries.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(e => uuidList.Contains(e.Uuid));
        }

        var entries = await query
            .OrderByDescending(e => e.OccurredAt)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return entries
            .Select(e => new GrantAuditDto(
                e.Uuid, e.OccurredAt, e.ActorUserUuid, e.SubjectType, e.SubjectUuid, e.Action, e.TargetCode, e.Reason, e.Source))
            .ToList();
    }
}
