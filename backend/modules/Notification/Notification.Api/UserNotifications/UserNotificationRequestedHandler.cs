using System.Text.Json;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Notification.Api.Hubs;
using Notification.Domain.UserNotifications;
using Notification.Infrastructure.Persistence;

namespace Notification.Api.UserNotifications;

#pragma warning disable CA1822

/// <summary>
/// Fan-out + zapis feedu + push realtime dla <see cref="UserNotificationRequested"/> — w jednym
/// handlerze, nie w dwóch (jeden w Infrastructure na DB, drugi w Api na SignalR), bo push kanałem
/// <c>notifications</c> niesie AKTUALNY licznik nieprzeczytanych obok uuid (patrz
/// <c>docs/backend/user-notifications.md</c> §7 — <c>ReceiveNotification(uuid, unreadCount)</c>),
/// a policzenie go bez wcześniejszego zapisu dałoby wyścig z drugim zdarzeniem, które nadejdzie
/// tuż po. Handler żyje w <c>Api</c>, bo potrzebuje <see cref="IHubContext{SyncHub}"/>, którego
/// <c>Infrastructure</c> nie może referencować (odwrotny kierunek zależności) — referencja
/// Api → Infrastructure w drugą stronę jest już i tak częścią projektu (patrz <c>Program.cs</c>).
/// </summary>
public sealed partial class UserNotificationRequestedHandler
{
    /// <summary>Powyżej tego progu odbiorcy są ucinani, nie odrzucani całkowicie — jedno
    /// nieostrożnie szerokie wyliczenie odbiorców u producenta nie może zawiesić konsumenta
    /// na tysiącach insertów w jednej transakcji (patrz plan Etap D).</summary>
    private const int MaxRecipientsPerEvent = 500;

    public async Task Handle(
        UserNotificationRequested message,
        NotificationDbContext db,
        IUnitOfWork unitOfWork,
        IHubContext<SyncHub> hub,
        ILogger<UserNotificationRequestedHandler> logger,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(message);

        // Sprawca nigdy nie dostaje powiadomienia o własnej akcji — ostatnia linia obrony,
        // producent i tak nie powinien go wpisywać do Recipients.
        var recipients = message.Recipients
            .Where(r => !string.IsNullOrWhiteSpace(r) && !string.Equals(r, message.ActorId, StringComparison.Ordinal))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (recipients.Count == 0)
        {
            return;
        }

        if (recipients.Count > MaxRecipientsPerEvent)
        {
            LogTruncated(logger, message.Kind, recipients.Count, MaxRecipientsPerEvent);
            recipients = recipients.Take(MaxRecipientsPerEvent).ToList();
        }

        var paramsJson = JsonSerializer.Serialize(message.Params);
        var affected = new List<(string UserId, Guid NotificationUuid)>(recipients.Count);

        foreach (var recipient in recipients)
        {
            var notificationUuid = await UpsertForRecipientAsync(db, message, recipient, paramsJson, ct).ConfigureAwait(false);
            affected.Add((recipient, notificationUuid));
        }

        await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        foreach (var (userId, notificationUuid) in affected)
        {
            var unreadCount = await db.UserNotifications
                .AsNoTracking()
                .CountAsync(n => n.UserId == userId && n.ReadAt == null, ct)
                .ConfigureAwait(false);

            await hub.Clients.Group(GroupNames.ForUser(userId))
                .SendAsync("ReceiveNotification", notificationUuid, unreadCount, ct)
                .ConfigureAwait(false);
        }
    }

    /// <summary>
    /// Jeden odbiorca: trafienie w istniejący, jeszcze nieprzeczytany wpis tej samej grupy albo
    /// tego samego faktu (redostawa at-least-once) inkrementuje licznik zamiast zakładać nowy
    /// wiersz — patrz unikalne indeksy w <c>UserNotificationConfiguration</c>.
    /// </summary>
    private static async Task<Guid> UpsertForRecipientAsync(
        NotificationDbContext db,
        UserNotificationRequested message,
        string recipient,
        string paramsJson,
        CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(message.GroupKey))
        {
            var grouped = await db.UserNotifications
                .Where(n => n.UserId == recipient && n.GroupKey == message.GroupKey && n.ReadAt == null)
                .FirstOrDefaultAsync(ct)
                .ConfigureAwait(false);

            if (grouped is not null)
            {
                grouped.IncrementOccurrence(message.OccurredAt);
                return grouped.Uuid;
            }
        }

        var duplicate = await db.UserNotifications
            .Where(n => n.UserId == recipient
                && n.Kind == message.Kind
                && n.SubjectUuid == message.SubjectUuid
                && n.CorrelationId == message.CorrelationId)
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);

        if (duplicate is not null)
        {
            return duplicate.Uuid;
        }

        var notification = UserNotification.CreateForRecipient(
            Guid.CreateVersion7(),
            recipient,
            message.ActorId,
            message.Kind,
            (UserNotificationSeverity)message.Severity,
            message.SubjectSignature,
            message.SubjectUuid,
            message.SubjectKey,
            message.TitleKey,
            paramsJson,
            message.GroupKey,
            message.Link,
            message.CorrelationId,
            message.OccurredAt,
            message.OccurredAt.AddDays(90));

        db.UserNotifications.Add(notification);

        return notification.Uuid;
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Warning,
        Message = "UserNotificationRequested({Kind}) miało {RecipientCount} odbiorców — ucięto do {Limit}.")]
    private static partial void LogTruncated(ILogger logger, string kind, int recipientCount, int limit);
}

#pragma warning restore CA1822
