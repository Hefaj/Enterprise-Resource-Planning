using Erp.BuildingBlocks.Domain;
using TaskManagement.Domain.Automation;

namespace TaskManagement.Domain.Webhooks;

/// <summary>
/// Jedna próba dostarczenia zdarzenia do jednego <see cref="Webhook"/> — agregat własny (wzorem
/// <see cref="Automation.AutomationRun"/>), NIE kolekcja podrzędna <c>Webhook</c>: webhook żyjący
/// miesiącami zbiera setki dostarczeń, a repozytorium webhooka nie może rosnąć z nimi przy każdym
/// odczycie. W odróżnieniu od <c>AutomationRun</c> (log tylko do dopisywania) ten agregat JEST
/// mutowalny — musi pamiętać próby ponowienia (API-004 AC1: dostarczenie nie idzie z transakcji
/// komendy, więc leci w tle, z retry, a dyspozytor musi wiedzieć, gdzie stanął).
/// </summary>
public sealed class WebhookDelivery : AggregateRoot
{
    /// <summary>Twardy limit prób jednego dostarczenia — bez tego martwy adres URL zajmowałby
    /// dyspozytora bez końca (ten sam rodzaj ryzyka co brak limitu głębokości w AUT-001).</summary>
    public const int MaxAttempts = 5;

    public const int MaxErrorMessageLength = 512;

    /// <summary>Konstruktor dla EF Core.</summary>
    private WebhookDelivery()
    {
    }

    private WebhookDelivery(
        Guid uuid,
        Guid webhookUuid,
        Guid issueUuid,
        AutomationTriggerKind eventKind,
        string payloadJson,
        DateTimeOffset now) : base(uuid)
    {
        WebhookUuid = webhookUuid;
        IssueUuid = issueUuid;
        EventKind = eventKind;
        PayloadJson = payloadJson;
        Status = WebhookDeliveryStatus.Pending;
        AttemptCount = 0;
        NextAttemptAt = now;
        CreatedAt = now;
    }

    public Guid WebhookUuid { get; private set; }

    public Guid IssueUuid { get; private set; }

    public AutomationTriggerKind EventKind { get; private set; }

    public string PayloadJson { get; private set; } = string.Empty;

    public WebhookDeliveryStatus Status { get; private set; }

    public int AttemptCount { get; private set; }

    public DateTimeOffset NextAttemptAt { get; private set; }

    public string? LastError { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static WebhookDelivery CreateWithUuid(
        Guid uuid,
        Guid webhookUuid,
        Guid issueUuid,
        AutomationTriggerKind eventKind,
        string payloadJson,
        DateTimeOffset now)
        => new(uuid, webhookUuid, issueUuid, eventKind, payloadJson, now);

    public void RecordSuccess(DateTimeOffset now)
    {
        Status = WebhookDeliveryStatus.Sent;
        AttemptCount++;
        LastError = null;
        NextAttemptAt = now;
    }

    /// <summary>Zwraca <c>true</c>, gdy to dostarczenie właśnie wyczerpało wszystkie próby —
    /// dyspozytor woła wtedy <see cref="Webhook.RecordDeliveryFailure"/>, bo TEN agregat nie zna
    /// innych dostarczeń tego samego webhooka i nie może sam zdecydować o jego wyłączeniu.
    /// Polityka odstępu między próbami (<paramref name="backoff"/>) jest sprawą dyspozytora
    /// (Application) — agregat wie tylko, KIEDY spróbować, nie DLACZEGO akurat wtedy.</summary>
    public bool RecordFailure(string errorMessage, DateTimeOffset now, TimeSpan backoff)
    {
        AttemptCount++;
        LastError = Trim(errorMessage);

        if (AttemptCount >= MaxAttempts)
        {
            Status = WebhookDeliveryStatus.Failed;
            return true;
        }

        NextAttemptAt = now + backoff;
        return false;
    }

    private static string? Trim(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length > MaxErrorMessageLength ? trimmed[..MaxErrorMessageLength] : trimmed;
    }
}
