using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Notification.Application.UserNotifications;
using Notification.Infrastructure.Persistence;

namespace Notification.Infrastructure.Queries;

/// <summary>Odczyty feedu powiadomień, bezpośrednio na EF Core — jak <c>JobQueries</c>.</summary>
public sealed class UserNotificationQueries : IUserNotificationQueries
{
    private readonly NotificationDbContext _dbContext;

    public UserNotificationQueries(NotificationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<SearchUserNotificationResponse> SearchAsync(
        SearchUserNotificationRequest request,
        string ownerUserId,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentException.ThrowIfNullOrWhiteSpace(ownerUserId);

        // Zawężenie do właściciela jest PIERWSZE i bezwarunkowe — jak w JobQueries.
        var query = _dbContext.UserNotifications.AsNoTracking().Where(n => n.UserId == ownerUserId);

        if (request.OnlyUnread == true)
        {
            query = query.Where(n => n.ReadAt == null);
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var page = await query
            .OrderByDescending(n => n.LastOccurredAt)
            .ThenBy(n => n.Uuid)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var items = page.Select(ToDto).ToList();

        return new SearchUserNotificationResponse { Items = items, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public Task<int> GetUnreadCountAsync(string ownerUserId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(ownerUserId);

        return _dbContext.UserNotifications
            .AsNoTracking()
            .Where(n => n.UserId == ownerUserId && n.ReadAt == null)
            .CountAsync(cancellationToken);
    }

    private static UserNotificationDto ToDto(Domain.UserNotifications.UserNotification n) => new(
        n.Uuid,
        n.ActorId,
        n.Kind,
        (Erp.BuildingBlocks.Contracts.NotificationSeverity)n.Severity,
        n.SubjectSignature,
        n.SubjectUuid,
        n.SubjectKey,
        n.TitleKey,
        JsonSerializer.Deserialize<Dictionary<string, string>>(n.ParamsJson) ?? [],
        n.GroupKey,
        n.OccurrenceCount,
        n.LastOccurredAt,
        n.Link,
        n.CreatedAt,
        n.SeenAt,
        n.ReadAt);
}
