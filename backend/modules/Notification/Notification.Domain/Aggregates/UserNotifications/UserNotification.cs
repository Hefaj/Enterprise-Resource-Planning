using Erp.BuildingBlocks.Domain;

namespace Notification.Domain.UserNotifications;

/// <summary>Waga powiadomienia w repozytorium — odpowiednik <c>Erp.BuildingBlocks.Contracts.NotificationSeverity</c>,
/// zduplikowany celowo: Domain nie może zależeć od Contracts (jak <c>NotificationJobStatus</c> obok
/// <c>JobStatus</c>). Konwersja żyje w Api, gdzie oba typy się spotykają.</summary>
public enum UserNotificationSeverity
{
    Info = 0,
    Warning = 1,
    Critical = 2,
}

/// <summary>
/// Jeden wiersz w osobistym feedzie powiadomień jednego odbiorcy — fan-out zapisany przy
/// wstawianiu, nie event+join. Feed (<c>where user_uuid=@me order by created_at desc</c>) i
/// licznik nieprzeczytanych muszą trafiać w indeks bez joinu, więc każdy odbiorca dostaje
/// własny wiersz zamiast wspólnego wiersza zdarzenia (patrz <c>docs/modules/notification/user-notifications.md</c> §4).
///
/// Zasilana wyłącznie <see cref="UserNotificationRequested"/> (patrz
/// <c>Notification.Api/UserNotifications/Consumers</c>) — tak jak <c>NotificationJob</c>, nie ma
/// tu reguł biznesowych do naruszenia, metody tylko projektują fakt, który już zaszedł gdzie indziej.
/// </summary>
public class UserNotification : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected UserNotification()
    {
    }

    private UserNotification(
        Guid uuid,
        string userId,
        string? actorId,
        string kind,
        UserNotificationSeverity severity,
        string subjectSignature,
        Guid subjectUuid,
        string? subjectKey,
        string titleKey,
        string paramsJson,
        string? groupKey,
        string link,
        Guid correlationId,
        DateTimeOffset createdAt,
        DateTimeOffset? expireOn) : base(uuid)
    {
        UserId = userId;
        ActorId = actorId;
        Kind = kind;
        Severity = severity;
        SubjectSignature = subjectSignature;
        SubjectUuid = subjectUuid;
        SubjectKey = subjectKey;
        TitleKey = titleKey;
        ParamsJson = paramsJson;
        GroupKey = groupKey;
        OccurrenceCount = 1;
        LastOccurredAt = createdAt;
        Link = link;
        CorrelationId = correlationId;
        CreatedAt = createdAt;
        ExpireOn = expireOn;
    }

    public string UserId { get; private set; } = string.Empty;

    /// <summary>Sprawca faktu, jeśli istnieje — do pokazania awatara/imienia w wierszu.
    /// Nigdy nie jest równe <see cref="UserId"/> (Notification wyklucza sprawcę z fan-outu
    /// przy zapisie, patrz konsument).</summary>
    public string? ActorId { get; private set; }

    public string Kind { get; private set; } = string.Empty;

    public UserNotificationSeverity Severity { get; private set; }

    public string SubjectSignature { get; private set; } = string.Empty;

    public Guid SubjectUuid { get; private set; }

    public string? SubjectKey { get; private set; }

    public string TitleKey { get; private set; } = string.Empty;

    /// <summary>Serializowane <c>Params</c> z kontraktu (jsonb) — teksty do podstawienia
    /// w przetłumaczonym tytule, nie klucze do dalszego tłumaczenia.</summary>
    public string ParamsJson { get; private set; } = "{}";

    public string? GroupKey { get; private set; }

    /// <summary>Ile razy ten wpis wchłonął kolejne pasujące zdarzenie zamiast założyć nowy
    /// wiersz — patrz deduplikacja po <see cref="GroupKey"/> w konsumencie.</summary>
    public int OccurrenceCount { get; private set; }

    public DateTimeOffset LastOccurredAt { get; private set; }

    public string Link { get; private set; } = string.Empty;

    /// <summary>Korelacja ze zdarzenia źródłowego — część klucza deduplikacji, gdy
    /// <see cref="GroupKey"/> jest puste.</summary>
    public Guid CorrelationId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>Moment otwarcia popovera dzwonka — odrębny od <see cref="ReadAt"/> (patrz
    /// <c>docs/guides/frontend/notifications.md</c> §10.2): zobaczenie na liście nie jest tym samym
    /// co jawne oznaczenie „przeczytane".</summary>
    public DateTimeOffset? SeenAt { get; private set; }

    public DateTimeOffset? ReadAt { get; private set; }

    public DateTimeOffset? ExpireOn { get; private set; }

    /// <summary>Materializuje wpis feedu jednego odbiorcy z <c>UserNotificationRequested</c>.</summary>
    public static UserNotification CreateForRecipient(
        Guid uuid,
        string userId,
        string? actorId,
        string kind,
        UserNotificationSeverity severity,
        string subjectSignature,
        Guid subjectUuid,
        string? subjectKey,
        string titleKey,
        string paramsJson,
        string? groupKey,
        string link,
        Guid correlationId,
        DateTimeOffset createdAt,
        DateTimeOffset? expireOn)
        => new(
            uuid, userId, actorId, kind, severity, subjectSignature, subjectUuid, subjectKey,
            titleKey, paramsJson, groupKey, link, correlationId, createdAt, expireOn);

    /// <summary>Kolejne zdarzenie trafiło w ten sam <see cref="GroupKey"/> zanim odbiorca zdążył
    /// przeczytać poprzednie — zamiast nowego wiersza, licznik rośnie na istniejącym.</summary>
    public void IncrementOccurrence(DateTimeOffset occurredAt)
    {
        OccurrenceCount++;
        LastOccurredAt = occurredAt;
    }

    public void MarkSeen(DateTimeOffset at)
    {
        SeenAt ??= at;
    }

    public void MarkRead(DateTimeOffset at)
    {
        ReadAt ??= at;
        SeenAt ??= at;
    }
}
