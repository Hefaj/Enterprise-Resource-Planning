using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using Notification.Application.UserNotifications;
using Notification.Infrastructure.Persistence;

namespace Notification.Infrastructure.Queries;

/// <summary>Oznaczanie przeczytania feedu — bezpośrednio na EF Core, poza pipeline'em komend
/// (uzasadnienie w <see cref="IUserNotificationCommands"/>).</summary>
public sealed class UserNotificationCommands : IUserNotificationCommands
{
    private readonly NotificationDbContext _dbContext;
    private readonly IClock _clock;

    public UserNotificationCommands(NotificationDbContext dbContext, IClock clock)
    {
        _dbContext = dbContext;
        _clock = clock;
    }

    /// <inheritdoc />
    public async Task SetReadAsync(Guid uuid, string ownerUserId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(ownerUserId);

        var now = _clock.UtcNow;

        // Zawężenie do właściciela w WHERE, nie po załadowaniu — inaczej dowolne uuid cudzego
        // wiersza dawałoby się oznaczyć jako przeczytane (bez odczytania treści, ale wciąż
        // manipulacja cudzym stanem).
        await _dbContext.UserNotifications
            .Where(n => n.Uuid == uuid && n.UserId == ownerUserId && n.ReadAt == null)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(n => n.ReadAt, now)
                    .SetProperty(n => n.SeenAt, n => n.SeenAt ?? now),
                cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task SetAllReadAsync(string ownerUserId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(ownerUserId);

        var now = _clock.UtcNow;

        await _dbContext.UserNotifications
            .Where(n => n.UserId == ownerUserId && n.ReadAt == null)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(n => n.ReadAt, now)
                    .SetProperty(n => n.SeenAt, n => n.SeenAt ?? now),
                cancellationToken)
            .ConfigureAwait(false);
    }
}
