using Erp.BuildingBlocks.Domain;

namespace Notification.Domain.UserNotifications;

public enum UserNotificationSeverity
{
    Info = 0,
    Warning = 1,
    Critical = 2,
}

/// <summary>Dane, z których domena buduje wpis skrzynki. Infrastructure mapuje tu wersjonowany
/// komunikat integracyjny, dzięki czemu Domain nie zna Contracts ani transportu RabbitMQ.</summary>
public sealed record UserNotificationContent(
    string Kind,
    string SubjectSignature,
    Guid SubjectUuid,
    string? SubjectKey,
    string TitleKey,
    IReadOnlyDictionary<string, string> Params,
    string? GroupKey,
    string Link,
    UserNotificationSeverity Severity,
    Guid CorrelationId,
    DateTimeOffset OccurredAt);

/// <summary>Wpis skrzynki jednego użytkownika; treść pozostaje kluczem tłumaczenia.</summary>
public sealed class UserNotification : AggregateRoot
{
    private UserNotification() { }

    private UserNotification(Guid uuid, Guid userUuid, UserNotificationContent content) : base(uuid)
    {
        UserUuid = userUuid; Kind = content.Kind; SubjectSignature = content.SubjectSignature;
        SubjectUuid = content.SubjectUuid; SubjectKey = content.SubjectKey; TitleKey = content.TitleKey;
        ParamsJson = System.Text.Json.JsonSerializer.Serialize(content.Params);
        GroupKey = content.GroupKey;
        CorrelationId = content.CorrelationId;
        Link = content.Link;
        Severity = content.Severity;
        CreatedAt = content.OccurredAt;
        LastOccurredAt = content.OccurredAt;
    }

    public Guid UserUuid { get; private set; }
    public string Kind { get; private set; } = string.Empty;
    public string SubjectSignature { get; private set; } = string.Empty;
    public Guid SubjectUuid { get; private set; }
    public string? SubjectKey { get; private set; }
    public string TitleKey { get; private set; } = string.Empty;
    public string ParamsJson { get; private set; } = "{}";
    public string? GroupKey { get; private set; }
    public Guid CorrelationId { get; private set; }
    public string Link { get; private set; } = string.Empty;
    public UserNotificationSeverity Severity { get; private set; }
    public int OccurrenceCount { get; private set; } = 1;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset LastOccurredAt { get; private set; }
    public DateTimeOffset? SeenAt { get; private set; }
    public DateTimeOffset? ReadAt { get; private set; }
    public DateTimeOffset? ExpireOn { get; private set; }

    public static UserNotification Create(Guid userUuid, UserNotificationContent content)
        => new(NewUuid(), userUuid, content);

    /// <summary>Scala kolejne zdarzenie w istniejącą, jeszcze nieprzeczytaną grupę.</summary>
    public void RegisterOccurrence(UserNotificationContent content)
    {
        ArgumentNullException.ThrowIfNull(content);

        OccurrenceCount++;
        LastOccurredAt = content.OccurredAt;
        SubjectKey = content.SubjectKey;
        TitleKey = content.TitleKey;
        ParamsJson = System.Text.Json.JsonSerializer.Serialize(content.Params);
        Link = content.Link;
        Severity = content.Severity;
    }
}
