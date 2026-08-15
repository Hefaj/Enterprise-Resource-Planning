using Erp.BuildingBlocks.Api.Contracts;
using Microsoft.EntityFrameworkCore;
using Notification.Application.Jobs;
using Notification.Infrastructure.Persistence;

namespace Notification.Infrastructure.Queries;

/// <summary>
/// Odczyty repliki zadań, bezpośrednio na EF Core.
///
/// Projekcja jest 1:1 z encją — <see cref="JobDto"/> został zwężony do pól, które replika
/// faktycznie posiada (patrz komentarz przy samym DTO), więc nie ma tu już nic do syntetyzowania
/// ani do wypełniania stałymi.
/// </summary>
public sealed class JobQueries : IJobQueries
{
    private readonly NotificationDbContext _dbContext;

    public JobQueries(NotificationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(SearchJobRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.NotificationJobs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.QueueId))
        {
            var term = request.QueueId;
            query = query.Where(j => j.QueueId != null && EF.Functions.ILike(j.QueueId, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(request.TrackingId))
        {
            var term = request.TrackingId;
            query = query.Where(j => EF.Functions.ILike(j.TrackingId, $"%{term}%"));
        }

        if (request.IsComplete.HasValue)
        {
            query = query.Where(j => j.IsComplete == request.IsComplete.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.UserId))
        {
            var term = request.UserId;
            query = query.Where(j => j.UserId != null && EF.Functions.ILike(j.UserId, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(request.ClientId))
        {
            var clientId = request.ClientId;
            query = query.Where(j => j.ClientId == clientId);
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await ApplySorting(query, request)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(j => j.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<JobDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, CancellationToken cancellationToken)
    {
        var query = _dbContext.NotificationJobs.AsNoTracking();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(j => uuidList.Contains(j.Uuid));
        }

        return await query
            .Select(j => new JobDto(
                j.Uuid,
                j.QueueId,
                j.TrackingId,
                j.CommandType,
                j.CommandJson,
                j.UiMetadata,
                j.Status,
                j.TotalCount,
                j.SucceededCount,
                j.FailedCount,
                j.IsComplete,
                j.ErrorsSummary,
                j.UserId,
                j.ClientId,
                j.CreatedAt,
                j.ExpireOn))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>Sortowanie po polach dopuszczonych przez kontrakt — whitelist, nie dynamiczne
    /// wyrażenie z nazwy pola żądania (patrz uzasadnienie w <c>Catalog ProductQueries</c>).</summary>
    private static IQueryable<Domain.Jobs.NotificationJob> ApplySorting(
        IQueryable<Domain.Jobs.NotificationJob> query,
        SearchJobRequest request)
    {
        if (request.Sorts is null || request.Sorts.Count == 0)
        {
            return query.OrderByDescending(j => j.CreatedAt).ThenBy(j => j.Uuid);
        }

        IOrderedQueryable<Domain.Jobs.NotificationJob>? ordered = null;

        foreach (var sort in request.Sorts)
        {
            var descending = sort.Order == -1;

            ordered = sort.Field.ToUpperInvariant() switch
            {
                "QUEUEID" => Chain(ordered, query, j => j.QueueId, descending),
                "TRACKINGID" => Chain(ordered, query, j => j.TrackingId, descending),
                "ISCOMPLETE" => Chain(ordered, query, j => j.IsComplete, descending),
                "STATUS" => Chain(ordered, query, j => j.Status, descending),
                "COMMANDTYPE" => Chain(ordered, query, j => j.CommandType, descending),
                "USERID" => Chain(ordered, query, j => j.UserId, descending),
                "CLIENTID" => Chain(ordered, query, j => j.ClientId, descending),
                "CREATEDAT" => Chain(ordered, query, j => j.CreatedAt, descending),
                "EXPIREON" => Chain(ordered, query, j => j.ExpireOn, descending),
                _ => ordered,
            };
        }

        return ordered is null
            ? query.OrderByDescending(j => j.CreatedAt).ThenBy(j => j.Uuid)
            : ordered.ThenBy(j => j.Uuid);
    }

    private static IOrderedQueryable<Domain.Jobs.NotificationJob> Chain<TKey>(
        IOrderedQueryable<Domain.Jobs.NotificationJob>? ordered,
        IQueryable<Domain.Jobs.NotificationJob> query,
        System.Linq.Expressions.Expression<Func<Domain.Jobs.NotificationJob, TKey>> selector,
        bool descending)
    {
        if (ordered is null)
        {
            return descending ? query.OrderByDescending(selector) : query.OrderBy(selector);
        }

        return descending ? ordered.ThenByDescending(selector) : ordered.ThenBy(selector);
    }
}
