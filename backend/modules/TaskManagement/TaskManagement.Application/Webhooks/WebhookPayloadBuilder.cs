using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Webhooks;

/// <summary>Ładunek POST-a wysyłanego do odbiorcy webhooka — mała, stabilna migawka, nie cały
/// <c>IssueDto</c>: odbiorca zewnętrzny nie ma prawa zobaczyć więcej niż to, co jest tu jawnie
/// wymienione, a kształt nie ma się zmieniać przy każdym polu dodanym do zgłoszenia.</summary>
public static class WebhookPayloadBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string Build(Issue issue, AutomationTriggerKind eventKind, Guid correlationId, DateTimeOffset occurredAt)
    {
        ArgumentNullException.ThrowIfNull(issue);

        var payload = new WebhookPayload(
            EventName(eventKind),
            issue.Uuid,
            issue.Key,
            issue.Title,
            issue.ProjectUuid,
            issue.StateUuid,
            issue.Priority,
            correlationId,
            occurredAt);

        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    /// <summary>Nazwa zdarzenia w konwencji „rzeczownik.czasownik", zgodnej z opisem API-004
    /// (<c>issue.created</c>, <c>issue.state.changed</c>, <c>comment.created</c>) — czytelna dla
    /// odbiorcy zewnętrznego, w odróżnieniu od nazwy enuma C#.</summary>
    private static string EventName(AutomationTriggerKind kind) => kind switch
    {
        AutomationTriggerKind.IssueCreated => "issue.created",
        AutomationTriggerKind.IssueStateChanged => "issue.state.changed",
        AutomationTriggerKind.CommentAdded => "comment.created",
        AutomationTriggerKind.DueDateElapsed => "issue.due_date_elapsed",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Nieznany rodzaj zdarzenia webhooka."),
    };

    private sealed record WebhookPayload(
        string Event,
        Guid IssueUuid,
        string IssueKey,
        string Title,
        Guid ProjectUuid,
        Guid StateUuid,
        IssuePriority Priority,
        Guid CorrelationId,
        DateTimeOffset OccurredAt);
}

/// <summary>
/// Podpis HMAC-SHA256 ładunku w nagłówku <c>X-Erp-Signature</c> — odbiorca liczy to samo
/// z sekretem, który dostał przy zapisie webhooka, i porównuje, żeby odrzucić żądania podszyte
/// pod ten serwis (ten sam mechanizm co GitHub/Stripe). Statyczna funkcja czysta — bez stanu,
/// żeby dyspozytor i (docelowo) testy liczyły podpis identycznie bez atrapy HTTP.
/// </summary>
public static class WebhookSignature
{
    public static string Compute(string secret, string payload)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(secret);
        ArgumentNullException.ThrowIfNull(payload);

        var keyBytes = Encoding.UTF8.GetBytes(secret);
        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        var hash = HMACSHA256.HashData(keyBytes, payloadBytes);

        return $"sha256={Convert.ToHexStringLower(hash)}";
    }
}
