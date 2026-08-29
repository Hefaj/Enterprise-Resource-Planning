using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Notification.Domain.UserNotifications;
using Notification.Infrastructure.Persistence;

namespace Notification.Infrastructure.Consumers;

#pragma warning disable CA1822 // Wolverine odkrywa wyłącznie instancyjne handlery komunikatów.

/// <summary>Fan-out trwałych wpisów; odbiorca otrzymuje własny wiersz skrzynki.</summary>
public sealed partial class UserNotificationRequestedHandler
{
    public async Task Handle(
        UserNotificationRequested message,
        NotificationDbContext db,
        IUnitOfWork unitOfWork,
        IIntegrationEventPublisher publisher,
        IOptions<UserNotificationOptions> options,
        ILogger<UserNotificationRequestedHandler> logger,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(message);

        var settings = options.Value;
        var recipients = message.Recipients
            .Where(id => id != Guid.Empty && id != message.ActorId)
            .Distinct()
            .Take(Math.Max(settings.MaxRecipientsPerEvent, 1))
            .ToList();

        if (message.Recipients.Count > recipients.Count)
        {
            LogRecipientLimitExceeded(logger, message.Kind, message.SubjectUuid, settings.MaxRecipientsPerEvent);
        }

        var effectiveGroupKey = ToWindowedGroupKey(message.GroupKey, message.OccurredAt, settings.GroupWindow);
        var content = new UserNotificationContent(
            message.Kind,
            message.SubjectSignature,
            message.SubjectUuid,
            message.SubjectKey,
            message.TitleKey,
            message.Params,
            effectiveGroupKey,
            message.Link,
            (UserNotificationSeverity)message.Severity,
            message.CorrelationId,
            message.OccurredAt);

        foreach (var recipient in recipients)
        {
            var existing = effectiveGroupKey is not null
                ? await db.UserNotifications.SingleOrDefaultAsync(
                    notification => notification.UserUuid == recipient && notification.GroupKey == effectiveGroupKey && notification.ReadAt == null,
                    ct).ConfigureAwait(false)
                : await db.UserNotifications.SingleOrDefaultAsync(
                    notification => notification.UserUuid == recipient
                        && notification.GroupKey == null
                        && notification.Kind == message.Kind
                        && notification.SubjectUuid == message.SubjectUuid
                        && notification.CorrelationId == message.CorrelationId,
                    ct).ConfigureAwait(false);

            if (existing is not null)
            {
                // Bez GroupKey identyczny event jest jedynie ponownym dostarczeniem z RabbitMQ,
                // nie kolejnym faktem biznesowym. Z grupą zwiększamy licznik wpisu.
                if (effectiveGroupKey is not null)
                {
                    existing.RegisterOccurrence(content);

                    var groupedUnreadCount = await db.UserNotifications
                        .CountAsync(item => item.UserUuid == recipient && item.ReadAt == null, ct)
                        .ConfigureAwait(false);

                    await publisher.PublishAsync(
                        new UserNotificationDelivered(existing.Uuid, recipient, groupedUnreadCount),
                        ct).ConfigureAwait(false);
                }

                continue;
            }

            var notification = UserNotification.Create(recipient, content);
            db.UserNotifications.Add(notification);

            // Licznik po zapisie będzie obejmował nowy wpis; zapytanie nie widzi jeszcze entity
            // Added, więc dokładamy jeden. To tylko hint dla badge — przy wyścigu feed pozostaje
            // źródłem prawdy.
            var unreadCount = await db.UserNotifications
                .CountAsync(item => item.UserUuid == recipient && item.ReadAt == null, ct)
                .ConfigureAwait(false) + 1;

            await publisher.PublishAsync(
                new UserNotificationDelivered(notification.Uuid, recipient, unreadCount),
                ct).ConfigureAwait(false);
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);
    }

    private static string? ToWindowedGroupKey(string? groupKey, DateTimeOffset occurredAt, TimeSpan window)
    {
        if (string.IsNullOrWhiteSpace(groupKey))
        {
            return null;
        }

        var windowTicks = Math.Max(window.Ticks, TimeSpan.FromMinutes(1).Ticks);
        var occurredAtTicks = occurredAt.UtcDateTime.Ticks;
        var windowStartTicks = occurredAtTicks - occurredAtTicks % windowTicks;
        return $"{groupKey}:{new DateTimeOffset(windowStartTicks, TimeSpan.Zero):yyyyMMddHHmm}";
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Warning,
        Message = "Powiadomienie {Kind} dla {SubjectUuid} przekroczyło limit odbiorców {MaxRecipients}; nadmiar został pominięty.")]
    private static partial void LogRecipientLimitExceeded(
        ILogger logger,
        string kind,
        Guid subjectUuid,
        int maxRecipients);
}

#pragma warning restore CA1822
