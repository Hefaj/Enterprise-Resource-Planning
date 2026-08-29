using Erp.BuildingBlocks.Api.Contracts;
using Microsoft.EntityFrameworkCore;
using Notification.Application.UserNotifications;
using Notification.Infrastructure.Persistence;

namespace Notification.Infrastructure.Queries;

/// <summary>Odczyty prywatnej skrzynki; parametr użytkownika zawsze pochodzi z kontekstu wykonania.</summary>
public sealed class UserNotificationQueries(NotificationDbContext db) : IUserNotificationQueries
{
    public async Task<SearchResponse> SearchAsync(SearchUserNotificationRequest request, string userId, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!Guid.TryParse(userId, out var userUuid)) return new SearchResponse { Uuids = [], TotalCount = 0 };

        var query = db.UserNotifications.AsNoTracking().Where(x => x.UserUuid == userUuid);
        var total = await query.CountAsync(ct).ConfigureAwait(false);
        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var uuids = await query
            .OrderByDescending(x => x.LastOccurredAt)
            .ThenBy(x => x.Uuid)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => x.Uuid)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = total };
    }

    public async Task<List<UserNotificationDto>> GetAsync(IReadOnlyCollection<Guid>? uuids, string userId, CancellationToken ct)
    {
        if (!Guid.TryParse(userId, out var userUuid)) return [];

        var query = db.UserNotifications.AsNoTracking().Where(x => x.UserUuid == userUuid);
        if (uuids is { Count: > 0 })
        {
            var requestedUuids = uuids.ToList();
            query = query.Where(x => requestedUuids.Contains(x.Uuid));
        }

        return await query
            .Select(x => new UserNotificationDto(x.Uuid, x.Kind, (Erp.BuildingBlocks.Contracts.NotificationSeverity)x.Severity, x.SubjectSignature,
                x.SubjectUuid, x.SubjectKey, x.TitleKey, x.ParamsJson, x.Link, x.OccurrenceCount,
                x.LastOccurredAt, x.SeenAt, x.ReadAt))
            .ToListAsync(ct)
            .ConfigureAwait(false);
    }
}
