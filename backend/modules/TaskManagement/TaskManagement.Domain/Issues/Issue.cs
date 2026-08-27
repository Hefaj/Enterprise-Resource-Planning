using Erp.BuildingBlocks.Domain;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Domain.Issues;

/// <summary>
/// Zgłoszenie — jednostka pracy tego modułu. <b>Nigdy „Task”</b>: słowo „zadanie” jest w tym
/// systemie zajęte trzykrotnie (<c>job</c>/<c>job_item</c> operacji masowych, historia zadań
/// z Notification, <c>WorkItem</c> obiegu w DMS) — patrz
/// <c>docs/backend/task-management.md</c> §2.
///
/// <para>Wyniki pracy (komentarze, historia zmian, praca zalogowana) wiszą przy zgłoszeniu,
/// nie przy tablicy — zgłoszenie może wejść na drugą tablicę albo z niej wypaść i niczego
/// to nie gubi (§3).</para>
/// </summary>
public sealed class Issue : AggregateRoot
{
    private readonly List<string> _previousKeys = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private Issue()
    {
    }

    private Issue(
        Guid uuid,
        Guid projectUuid,
        string key,
        string title,
        Guid stateUuid,
        Guid reporterUuid,
        DateTimeOffset createdAt)
        : base(uuid)
    {
        ProjectUuid = projectUuid;
        Key = key;
        Title = title;
        StateUuid = stateUuid;
        ReporterUuid = reporterUuid;
        Priority = IssuePriority.Normal;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public Guid ProjectUuid { get; private set; }

    /// <summary>Klucz czytelny (<c>DEV-123</c>) — unikalny globalnie, egzekwowany indeksem bazy.
    /// Użytkownik mówi „zrób DEV-412”, nie UUID-em, więc to on jest w trasie karty zgłoszenia.</summary>
    public string Key { get; private set; } = string.Empty;

    public string Title { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public IssuePriority Priority { get; private set; }

    /// <summary>Stan ze schematu projektu. Zgłoszenie jest w <b>dokładnie jednym</b> stanie —
    /// na tym niezmienniku stoi cała tablica (karta leży w jednej kolumnie), i to jest powód,
    /// dla którego nie da się tu użyć silnika z tokenami z DMS-u (§5.4).</summary>
    public Guid StateUuid { get; private set; }

    public Guid ReporterUuid { get; private set; }

    public Guid? AssigneeUuid { get; private set; }

    public DateTimeOffset? DueAt { get; private set; }

    /// <summary>Rodzic w hierarchii epik → zadanie → podzadanie. Kolumna jest od fazy 0,
    /// bo migracja tabeli z danymi kosztuje więcej niż pusta kolumna; wypełnia ją faza 4.</summary>
    public Guid? ParentUuid { get; private set; }

    /// <summary>Zgłoszenie prywatne — widoczne dla zgłaszającego, przypisanego i <c>Lead</c>
    /// projektu. Jeden z dwóch (i tylko dwóch) wyjątków od widoczności projektowej (§10.1).</summary>
    public bool IsRestricted { get; private set; }

    /// <summary>Klucze sprzed przeniesień do innych projektów. Wyszukiwanie idzie także po nich,
    /// inaczej „DEV-412” z maila przestaje cokolwiek znajdować dzień po przeniesieniu (§4).</summary>
    public IReadOnlyList<string> PreviousKeys => _previousKeys.AsReadOnly();

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>
    /// Zakłada zgłoszenie w stanie początkowym schematu. Klucz przychodzi z zewnątrz, bo jego
    /// nadanie jest zapytaniem do licznika projektu w tej samej transakcji — agregat nie ma
    /// jak go sobie wyliczyć (§4).
    /// </summary>
    public static Issue CreateWithUuid(
        Guid uuid,
        Guid projectUuid,
        string key,
        string title,
        WorkflowScheme scheme,
        Guid reporterUuid,
        DateTimeOffset createdAt)
    {
        ArgumentNullException.ThrowIfNull(scheme);

        if (projectUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.issue_project_empty", "Zgłoszenie musi należeć do projektu.");
        }

        if (string.IsNullOrWhiteSpace(key))
        {
            throw new DomainException("taskmgmt.issue_key_empty", "Zgłoszenie musi mieć klucz czytelny.");
        }

        return new Issue(uuid, projectUuid, key.Trim(), ValidateTitle(title), scheme.InitialState().Uuid, reporterUuid, createdAt);
    }

    public void SetTitle(string title, DateTimeOffset now)
    {
        Title = ValidateTitle(title);
        Touch(now);
    }

    public void SetDescription(string? description, DateTimeOffset now)
    {
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Touch(now);
    }

    public void SetPriority(IssuePriority priority, DateTimeOffset now)
    {
        Priority = priority;
        Touch(now);
    }

    public void SetAssignee(Guid? assigneeUuid, DateTimeOffset now)
    {
        AssigneeUuid = assigneeUuid == Guid.Empty ? null : assigneeUuid;
        Touch(now);
    }

    public void SetDueDate(DateTimeOffset? dueAt, DateTimeOffset now)
    {
        DueAt = dueAt;
        Touch(now);
    }

    public void SetRestricted(bool isRestricted, DateTimeOffset now)
    {
        IsRestricted = isRestricted;
        Touch(now);
    }

    /// <summary>
    /// Zmiana stanu wg schematu projektu. Schemat wchodzi parametrem, bo jest <b>osobnym
    /// agregatem</b> — a reguła i tak musi być tutaj: „metoda agregatu waliduje PRZED zmianą
    /// stanu” jest tym, na czym stoi częściowy sukces operacji masowej
    /// (<c>docs/backend/bulk-commands.md</c>).
    /// </summary>
    public void SetState(WorkflowScheme scheme, Guid toStateUuid, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(scheme);

        if (!scheme.HasState(toStateUuid))
        {
            throw new DomainException(
                "taskmgmt.transition_unknown_state",
                $"Stan {toStateUuid} nie należy do schematu `{scheme.Name}`.");
        }

        if (!scheme.AllowsTransition(StateUuid, toStateUuid))
        {
            throw new DomainException(
                "taskmgmt.transition_not_allowed",
                $"Przejście {StateUuid} → {toStateUuid} nie istnieje w schemacie `{scheme.Name}`.");
        }

        if (StateUuid == toStateUuid)
        {
            return;
        }

        StateUuid = toStateUuid;
        Touch(now);
    }

    /// <summary>Przenosi zgłoszenie do innego projektu, nadając <b>nowy</b> klucz i zachowując
    /// stary w <see cref="PreviousKeys"/>. Faza 4/6 — metoda jest tu, bo to ona uzasadnia
    /// kolumnę kluczy historycznych.</summary>
    public void MoveToProject(Guid projectUuid, string newKey, WorkflowScheme targetScheme, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(targetScheme);

        if (projectUuid == ProjectUuid)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(newKey))
        {
            throw new DomainException("taskmgmt.issue_key_empty", "Zgłoszenie musi mieć klucz czytelny.");
        }

        _previousKeys.Add(Key);
        ProjectUuid = projectUuid;
        Key = newKey.Trim();
        StateUuid = targetScheme.InitialState().Uuid;
        Touch(now);
    }

    private void Touch(DateTimeOffset now) => UpdatedAt = now;

    private static string ValidateTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new DomainException("taskmgmt.issue_title_empty", "Tytuł zgłoszenia nie może być pusty.");
        }

        var trimmed = title.Trim();

        if (trimmed.Length > 512)
        {
            throw new DomainException("taskmgmt.issue_title_too_long", "Tytuł zgłoszenia może mieć najwyżej 512 znaków.");
        }

        return trimmed;
    }
}
