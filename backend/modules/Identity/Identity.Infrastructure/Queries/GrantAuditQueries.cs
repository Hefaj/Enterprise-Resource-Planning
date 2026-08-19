using Erp.BuildingBlocks.Api.Contracts;
using Identity.Application.Audit;
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

        var uuids = await query
            .OrderByDescending(e => e.OccurredAt)
            .ThenBy(e => e.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(e => e.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
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
