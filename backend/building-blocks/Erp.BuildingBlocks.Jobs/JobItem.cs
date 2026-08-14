using Erp.BuildingBlocks.Domain;

namespace Erp.BuildingBlocks.Jobs;

/// <summary>Status pojedynczego elementu zadania masowego.</summary>
public enum JobItemStatus
{
    /// <summary>Czeka na przetworzenie.</summary>
    Pending = 0,

    /// <summary>Przetworzony pomyślnie.</summary>
    Succeeded = 1,

    /// <summary>Nieudany — powód w <see cref="JobItem.ErrorCode"/>.</summary>
    Failed = 2,

    /// <summary>Pominięty (np. zadanie anulowano przed dojściem do tego elementu).</summary>
    Skipped = 3,
}

/// <summary>
/// Pojedynczy element zadania masowego — jeden agregat, jedno wykonanie komendy, jeden wynik.
///
/// Ta tabela jest powodem, dla którego operacja na 50 tys. produktów da się w ogóle sensownie
/// zaraportować. Bez niej jedyną informacją zwrotną byłoby „poszło / nie poszło” dla całości,
/// a użytkownik, któremu odpadło 1200 pozycji, nie miałby jak się dowiedzieć których i dlaczego.
/// Jest też podstawą wznawiania po restarcie i ponawiania wyłącznie nieudanych elementów.
/// </summary>
public class JobItem : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    protected JobItem()
    {
    }

    private JobItem(Guid uuid, Guid jobUuid, Guid aggregateUuid, int ordinal) : base(uuid)
    {
        JobUuid = jobUuid;
        AggregateUuid = aggregateUuid;
        Ordinal = ordinal;
        Status = JobItemStatus.Pending;
    }

    /// <summary>Zadanie, do którego należy element.</summary>
    public Guid JobUuid { get; private set; }

    /// <summary>Agregat, na którym ma zostać wykonana komenda.</summary>
    public Guid AggregateUuid { get; private set; }

    /// <summary>Pozycja w zadaniu — zapewnia deterministyczną, powtarzalną kolejność
    /// przetwarzania także po restarcie procesu.</summary>
    public int Ordinal { get; private set; }

    public JobItemStatus Status { get; private set; }

    /// <summary>Maszynowo przetwarzalny kod błędu z <see cref="DomainException.ErrorCode"/> —
    /// pozwala pogrupować raport po przyczynie zamiast po treści komunikatu.</summary>
    public string? ErrorCode { get; private set; }

    /// <summary>Komunikat dla developera. Tekst dla użytkownika końcowego frontend buduje
    /// z <see cref="ErrorCode"/> przez Transloco.</summary>
    public string? ErrorMessage { get; private set; }

    /// <summary>Liczba prób wykonania — chroni przed zapętleniem na trwale nieudanym elemencie.</summary>
    public int Attempts { get; private set; }

    public DateTimeOffset? ProcessedAt { get; private set; }

    internal static JobItem Create(Guid jobUuid, Guid aggregateUuid, int ordinal)
        => new(NewUuid(), jobUuid, aggregateUuid, ordinal);

    /// <summary>Odnotowuje udane wykonanie.</summary>
    public void MarkSucceeded(DateTimeOffset processedAt)
    {
        Attempts++;
        Status = JobItemStatus.Succeeded;
        ErrorCode = null;
        ErrorMessage = null;
        ProcessedAt = processedAt;
    }

    /// <summary>
    /// Odnotowuje nieudane wykonanie. Element wraca do <see cref="JobItemStatus.Pending"/>,
    /// dopóki nie wyczerpie limitu prób — dzięki temu błąd przejściowy (zerwane połączenie,
    /// konflikt optymistyczny) nie skazuje elementu na trwałą porażkę, ale błąd deterministyczny
    /// (ujemna cena) nie zapętla runnera w nieskończoność.
    /// </summary>
    public void MarkFailed(string errorCode, string errorMessage, int maxAttempts, DateTimeOffset processedAt)
    {
        Attempts++;
        ErrorCode = errorCode;
        ErrorMessage = errorMessage;
        ProcessedAt = processedAt;
        Status = Attempts >= maxAttempts ? JobItemStatus.Failed : JobItemStatus.Pending;
    }

    /// <summary>Oznacza element jako pominięty (zadanie anulowane).</summary>
    public void MarkSkipped(DateTimeOffset processedAt)
    {
        Status = JobItemStatus.Skipped;
        ProcessedAt = processedAt;
    }

    /// <summary>Czy element osiągnął stan końcowy i nie zostanie już podjęty.</summary>
    public bool IsTerminal => Status is JobItemStatus.Succeeded or JobItemStatus.Failed or JobItemStatus.Skipped;
}
