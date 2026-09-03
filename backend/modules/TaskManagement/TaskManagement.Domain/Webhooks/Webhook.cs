using Erp.BuildingBlocks.Domain;
using TaskManagement.Domain.Automation;

namespace TaskManagement.Domain.Webhooks;

/// <summary>
/// Webhook wychodzący (API-004) — projekt rejestruje adres URL, który dostaje POST przy
/// wybranych zdarzeniach cyklu życia zgłoszenia. Reużywa <see cref="AutomationTriggerKind"/>
/// jako zbiór subskrybowalnych zdarzeń — to ten sam zamknięty zestaw „coś się stało ze
/// zgłoszeniem"; automatyzacja i webhook różnią się tylko tym, co z tym faktem robią (komenda
/// na zgłoszeniu kontra POST na zewnątrz), nie tym, co je wyzwala.
///
/// <para><see cref="Secret"/> podpisuje ładunek HMAC-SHA256 w nagłówku
/// <c>X-Erp-Signature</c> (Application/Infrastructure) — odbiorca weryfikuje, że żądanie
/// faktycznie stąd pochodzi.</para>
///
/// <para><see cref="ConsecutiveFailureCount"/> to okap bezpieczeństwa (API-004: „wyłączenie po
/// serii błędów") — martwy adres URL nie ma bombardować zewnętrznego serwisu w nieskończoność.
/// Liczy DOSTARCZENIA, które wyczerpały wszystkie próby (<see cref="WebhookDelivery"/>), nie
/// pojedyncze próby — inaczej webhook wyłączyłby się po jednym przejściowym zacięciu sieci.
/// Resetuje się przy udanym dostarczeniu i przy ręcznym włączeniu.</para>
/// </summary>
public sealed class Webhook : AggregateRoot
{
    /// <summary>Próg kolejnych nieudanych DOSTARCZEŃ, po którym webhook wyłącza się sam.</summary>
    public const int AutoDisableThreshold = 10;

    private readonly List<AutomationTriggerKind> _eventKinds = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private Webhook()
    {
    }

    private Webhook(
        Guid uuid,
        Guid projectUuid,
        string url,
        string secret,
        IEnumerable<AutomationTriggerKind> eventKinds,
        DateTimeOffset createdAt) : base(uuid)
    {
        ProjectUuid = projectUuid;
        Url = url;
        Secret = secret;
        _eventKinds = ValidateEventKinds(eventKinds);
        IsEnabled = true;
        ConsecutiveFailureCount = 0;
        CreatedAt = createdAt;
    }

    public Guid ProjectUuid { get; private set; }

    public string Url { get; private set; } = string.Empty;

    public string Secret { get; private set; } = string.Empty;

    public IReadOnlyList<AutomationTriggerKind> EventKinds => _eventKinds.AsReadOnly();

    public bool IsEnabled { get; private set; }

    public int ConsecutiveFailureCount { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static Webhook CreateWithUuid(
        Guid uuid,
        Guid projectUuid,
        string url,
        string secret,
        IEnumerable<AutomationTriggerKind> eventKinds,
        DateTimeOffset now)
    {
        if (projectUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.webhook_project_missing", "Webhook musi należeć do projektu.");
        }

        return new Webhook(uuid, projectUuid, ValidateUrl(url), ValidateSecret(secret), eventKinds, now);
    }

    /// <summary>Nadpisuje adres, sekret i subskrybowane zdarzenia naraz, wzorem
    /// <c>AutomationRule.Set</c>. Włączenie/wyłączenie idzie osobnymi metodami.</summary>
    public void Set(string url, string secret, IEnumerable<AutomationTriggerKind> eventKinds)
    {
        Url = ValidateUrl(url);
        Secret = ValidateSecret(secret);

        var materialized = ValidateEventKinds(eventKinds);
        _eventKinds.Clear();
        _eventKinds.AddRange(materialized);
    }

    /// <summary>Ręczne włączenie resetuje licznik — operator świadomie daje webhookowi czystą
    /// kartę, np. po naprawieniu odbiorcy.</summary>
    public void Enable()
    {
        IsEnabled = true;
        ConsecutiveFailureCount = 0;
    }

    public void Disable() => IsEnabled = false;

    public bool Subscribes(AutomationTriggerKind kind) => IsEnabled && _eventKinds.Contains(kind);

    /// <summary>Wołane po udanym dostarczeniu (Application: dyspozytor). Agregat nie wie nic
    /// o HTTP, tylko o skutku.</summary>
    public void RecordDeliverySuccess() => ConsecutiveFailureCount = 0;

    /// <summary>Wołane, gdy DOSTARCZENIE wyczerpało wszystkie próby ponowienia (nie każda
    /// pojedyncza próba, patrz <see cref="WebhookDelivery.RecordFailure"/>).</summary>
    public void RecordDeliveryFailure()
    {
        ConsecutiveFailureCount++;

        if (ConsecutiveFailureCount >= AutoDisableThreshold)
        {
            IsEnabled = false;
        }
    }

    private static List<AutomationTriggerKind> ValidateEventKinds(IEnumerable<AutomationTriggerKind> eventKinds)
    {
        var materialized = eventKinds.Distinct().ToList();

        if (materialized.Count == 0)
        {
            throw new DomainException(
                "taskmgmt.webhook_without_event",
                "Webhook musi być zapisany na co najmniej jedno zdarzenie.");
        }

        return materialized;
    }

    private static string ValidateUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            throw new DomainException("taskmgmt.webhook_url_empty", "Webhook musi mieć adres.");
        }

        var trimmed = url.Trim();

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var parsed)
            || (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps))
        {
            throw new DomainException(
                "taskmgmt.webhook_url_invalid", "Adres webhooka musi być pełnym adresem http(s).");
        }

        return trimmed.Length > 2048 ? trimmed[..2048] : trimmed;
    }

    private static string ValidateSecret(string secret)
    {
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new DomainException(
                "taskmgmt.webhook_secret_empty", "Webhook musi mieć sekret do podpisywania ładunku.");
        }

        var trimmed = secret.Trim();

        if (trimmed.Length < 16)
        {
            throw new DomainException(
                "taskmgmt.webhook_secret_too_short", "Sekret webhooka musi mieć co najmniej 16 znaków.");
        }

        return trimmed.Length > 256 ? trimmed[..256] : trimmed;
    }
}
