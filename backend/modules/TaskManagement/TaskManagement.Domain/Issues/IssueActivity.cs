using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues;

/// <summary>
/// Wpis historii zgłoszenia — <b>tylko do dopisywania</b>, nigdy do zmiany ani usunięcia
/// (<c>docs/backend/task-management.md</c> §11).
///
/// <para><b>To nie jest to samo, co <c>AggregateChanged</c> ze skanu ChangeTrackera.</b> Tamto
/// mówi „coś się zmieniło” na potrzeby cache’u i powstaje automatycznie; to jest <b>treść
/// zmiany pole po polu</b>, pokazywana użytkownikowi na karcie. Skan nie zna znaczenia pól,
/// nie odróżnia zmiany istotnej od technicznej i nie umie powiedzieć, co było przedtem —
/// dlatego zapis jest jawny, w komendzie, a nie w infrastrukturze.</para>
///
/// <para>Wartości są tekstem, nie typem pola. Historia ma być czytelna po latach, także dla
/// pola, którego już nie ma w schemacie projektu — a to wyklucza trzymanie ich w kolumnach
/// typowanych per pole.</para>
/// </summary>
public sealed class IssueActivity : AggregateRoot
{
    /// <summary>Ile znaków wartości trafia do historii. Powyżej tego zapisuje się sam fakt
    /// zmiany: opis zgłoszenia bywa wielostronicowy, a jego dwie pełne kopie przy każdej
    /// edycji zamieniłyby historię w archiwum treści.</summary>
    public const int MaxValueLength = 512;

    /// <summary>Konstruktor dla EF Core.</summary>
    private IssueActivity()
    {
    }

    private IssueActivity(
        Guid uuid,
        Guid issueUuid,
        IssueActivityKind kind,
        string? fieldCode,
        string? oldValue,
        string? newValue,
        Guid actorUuid,
        Guid correlationId,
        DateTimeOffset occurredAt) : base(uuid)
    {
        IssueUuid = issueUuid;
        Kind = kind;
        FieldCode = fieldCode;
        OldValue = oldValue;
        NewValue = newValue;
        ActorUuid = actorUuid;
        CorrelationId = correlationId;
        OccurredAt = occurredAt;
    }

    public Guid IssueUuid { get; private set; }

    public IssueActivityKind Kind { get; private set; }

    /// <summary>Kod pola w postaci technicznej (<c>title</c>, <c>state</c>, <c>assignee</c>).
    /// Front tłumaczy go na nazwę — w historii nie ma tekstu w żadnym języku.</summary>
    public string? FieldCode { get; private set; }

    public string? OldValue { get; private set; }

    public string? NewValue { get; private set; }

    public Guid ActorUuid { get; private set; }

    /// <summary>Korelacja operacji (<c>X-Request-Id</c> → <c>CorrelationId</c>). Po niej łączy
    /// się wpis historii z logami i ze zdarzeniem realtime tej samej zmiany.</summary>
    public Guid CorrelationId { get; private set; }

    public DateTimeOffset OccurredAt { get; private set; }

    /// <summary>
    /// Zapisuje wpis. Uuid nadaje ta metoda, bo wpisu historii nikt z zewnątrz nie adresuje —
    /// nie ma komendy, która by go zmieniała ani usuwała.
    /// </summary>
    public static IssueActivity Record(
        Guid issueUuid,
        IssueActivityKind kind,
        string? fieldCode,
        string? oldValue,
        string? newValue,
        Guid actorUuid,
        Guid correlationId,
        DateTimeOffset occurredAt)
    {
        if (issueUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.activity_issue_empty",
                "Wpis historii musi należeć do zgłoszenia.");
        }

        return new IssueActivity(
            Guid.CreateVersion7(),
            issueUuid,
            kind,
            fieldCode,
            Trim(oldValue),
            Trim(newValue),
            actorUuid,
            correlationId,
            occurredAt);
    }

    /// <summary>Wartość przycięta do <see cref="MaxValueLength"/>; pusta staje się
    /// <c>null</c>, żeby „brak wartości” miał w historii jedną reprezentację.</summary>
    private static string? Trim(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();

        return trimmed.Length > MaxValueLength ? trimmed[..MaxValueLength] : trimmed;
    }
}
