using Erp.BuildingBlocks.Domain;
using TaskManagement.Domain.FieldSchemes;
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

    /// <summary>Wartości pól niestandardowych w postaci kanonicznej, kluczowane kodem pola —
    /// źródło prawdy. Sloty poniżej są ich <b>duplikatem</b> utrzymywanym wyłącznie po to,
    /// żeby dało się po nich sortować i filtrować w SQL (§6).</summary>
    private readonly Dictionary<string, string> _customFields = [];

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
        StateCategory = WorkflowStateCategory.Todo;
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

    /// <summary>Kategoria bieżącego stanu utrwalona obok identyfikatora stanu. Jest projekcją
    /// automatu, ale pozwala skanowi SLA przejść po częściowym indeksie bez joina do schematu.</summary>
    public WorkflowStateCategory StateCategory { get; private set; }

    /// <summary>
    /// Zagregowany postęp zgłoszeń wykonawczych powiązanych relacją <c>Delivers</c>.
    /// Wartość ma znaczenie wyłącznie dla zlecenia w projekcie <c>Intake</c>; nie jest jego
    /// własnym stanem, ponieważ odbiór realizacji pozostaje decyzją człowieka (§9.2).
    /// </summary>
    public WorkflowStateCategory? DerivedDeliveryState { get; private set; }

    public Guid ReporterUuid { get; private set; }

    public Guid? AssigneeUuid { get; private set; }

    public DateTimeOffset? DueAt { get; private set; }

    /// <summary>Dzień ostatniego przypomnienia SLA. Zapobiega wielokrotnej eskalacji w tym samym
    /// dniu, gdy usługa cykliczna uruchomi się ponownie lub pracuje kilka godzin.</summary>
    public DateOnly? SlaLastNotifiedOn { get; private set; }

    /// <summary>Rodzic w hierarchii epik → zadanie → podzadanie. <b>Jeden rodzic</b> — to jest
    /// różnica wobec powiązań (<see cref="IssueLink"/>), które są grafem (§8.1).</summary>
    public Guid? ParentUuid { get; private set; }

    /// <summary>Zgłoszenie prywatne — widoczne dla zgłaszającego, przypisanego i <c>Lead</c>
    /// projektu. Jeden z dwóch (i tylko dwóch) wyjątków od widoczności projektowej (§10.1).</summary>
    public bool IsRestricted { get; private set; }

    /// <summary>Klucze sprzed przeniesień do innych projektów. Wyszukiwanie idzie także po nich,
    /// inaczej „DEV-412” z maila przestaje cokolwiek znajdować dzień po przeniesieniu (§4).</summary>
    public IReadOnlyList<string> PreviousKeys => _previousKeys.AsReadOnly();

    /// <summary>
    /// Wartości pól niestandardowych: kod pola → wartość kanoniczna
    /// (<see cref="CustomFieldValue.ToCanonicalString"/>). Pole bez wartości nie ma wpisu.
    /// </summary>
    public IReadOnlyDictionary<string, string> CustomFields => _customFields.AsReadOnly();

    // ── Sloty sortowalne ──
    //
    // Stała pula kolumn, w której DUBLUJĄ SIĘ wartości pól sortowalnych i filtrowalnych.
    // To nie jest drugie źródło prawdy, tylko projekcja `custom_fields` utrzymywana w tej samej
    // metodzie, co one — rozjazd wymagałby zapisu z pominięciem `SetCustomFields`, a takiej
    // ścieżki nie ma. Dlaczego sloty, a nie indeksy wyrażeniowe na jsonb, tabele projekcji
    // per typ czy EAV: docs/backend/dms-workflow.md §3.2.

    public decimal? Num1 { get; private set; }

    public decimal? Num2 { get; private set; }

    public decimal? Num3 { get; private set; }

    public decimal? Num4 { get; private set; }

    public string? Text1 { get; private set; }

    public string? Text2 { get; private set; }

    public string? Text3 { get; private set; }

    public string? Text4 { get; private set; }

    public DateTimeOffset? Date1 { get; private set; }

    public DateTimeOffset? Date2 { get; private set; }

    public DateTimeOffset? Date3 { get; private set; }

    public DateTimeOffset? Date4 { get; private set; }

    public Guid? User1 { get; private set; }

    public Guid? User2 { get; private set; }

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

        var initialState = scheme.InitialState();
        var issue = new Issue(uuid, projectUuid, key.Trim(), ValidateTitle(title), initialState.Uuid, reporterUuid, createdAt)
        {
            StateCategory = initialState.Category,
        };

        return issue;
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

    public bool TryMarkSlaReminder(DateOnly today, DateTimeOffset now)
    {
        if (SlaLastNotifiedOn == today)
        {
            return false;
        }

        SlaLastNotifiedOn = today;
        Touch(now);
        return true;
    }

    public void SetRestricted(bool isRestricted, DateTimeOffset now)
    {
        IsRestricted = isRestricted;
        Touch(now);
    }

    /// <summary>Aktualizuje projekcję postępu realizacji bez zmieniania stanu zlecenia.</summary>
    public void SetDerivedDeliveryState(WorkflowStateCategory? state, DateTimeOffset now)
    {
        if (DerivedDeliveryState == state)
        {
            return;
        }

        DerivedDeliveryState = state;
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
        StateCategory = scheme.State(toStateUuid).Category;
        Touch(now);
    }

    /// <summary>Przenosi zgłoszenie do stanu wskazanego podczas publikacji schematu.
    /// Nie jest to przejście użytkownika: poprzedni stan właśnie znika, więc nie można
    /// wymagać krawędzi automatu, która przestała istnieć.</summary>
    public void MigrateWorkflowState(WorkflowScheme scheme, Guid toStateUuid, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(scheme);
        if (!scheme.HasState(toStateUuid))
        {
            throw new DomainException("taskmgmt.workflow_migration_unknown_target", "Stan docelowy migracji nie należy do opublikowanego schematu.");
        }

        if (StateUuid == toStateUuid)
        {
            return;
        }

        StateUuid = toStateUuid;
        StateCategory = scheme.State(toStateUuid).Category;
        Touch(now);
    }

    /// <summary>
    /// Nadpisuje <b>całą</b> kolekcję wartości pól niestandardowych — to, co przyszło, jest tym,
    /// co zostaje; pole pominięte w żądaniu zostaje wyczyszczone razem ze swoim slotem
    /// (<c>docs/backend/endpoint-naming.md</c> §2).
    ///
    /// <para>Schemat wchodzi parametrem, bo jest <b>osobnym agregatem</b> — tak samo jak schemat
    /// stanów przy <see cref="SetState"/>. Cała walidacja dzieje się PRZED pierwszą zmianą
    /// stanu: zgłoszenie z jednym błędnym polem nie może zostać z połową zapisanych wartości,
    /// bo na tym stoi częściowy sukces operacji masowej.</para>
    /// </summary>
    public void SetCustomFields(
        FieldScheme scheme,
        IReadOnlyDictionary<string, string?> values,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(scheme);
        ArgumentNullException.ThrowIfNull(values);

        var unknown = values.Keys.FirstOrDefault(code => scheme.FindByCode(code) is null);

        if (unknown is not null)
        {
            throw new DomainException(
                "taskmgmt.field_unknown",
                $"Pole `{unknown}` nie należy do schematu pól `{scheme.Name}`.");
        }

        // Najpierw rozkładamy WSZYSTKIE wartości — dopiero potem dotykamy stanu. Rozkładanie
        // w pętli zapisującej zostawiałoby zgłoszenie w połowie zmienione, gdy piąte pole
        // okaże się nieliczbą.
        var parsed = new List<(FieldDefinition Definition, CustomFieldValue Value)>(scheme.Fields.Count);

        foreach (var definition in scheme.Fields)
        {
            values.TryGetValue(definition.Code, out var raw);
            parsed.Add((definition, CustomFieldValue.Parse(definition, raw)));
        }

        _customFields.Clear();
        ClearSlots();

        foreach (var (definition, value) in parsed)
        {
            if (value.IsEmpty)
            {
                continue;
            }

            _customFields[definition.Code] = value.ToCanonicalString()!;
            WriteSlot(definition.Slot, value);
        }

        Touch(now);
    }

    /// <summary>
    /// Uzupełnia wyłącznie wartości podane przy przejściu workflow i sprawdza, czy krawędź ma
    /// wszystkie wymagane dane. Nie jest to drugi wariant publicznego „ustaw pola”: zwykła
    /// komenda nadal zastępuje pełną kolekcję. Tutaj scalanie jest konieczne, bo przejście może
    /// pytać tylko o brakujący numer protokołu bez kasowania pozostałych pól zgłoszenia.
    /// </summary>
    public void SetTransitionCustomFields(
        FieldScheme scheme,
        IReadOnlyCollection<string> requiredFieldCodes,
        IReadOnlyDictionary<string, string?> values,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(scheme);
        ArgumentNullException.ThrowIfNull(requiredFieldCodes);
        ArgumentNullException.ThrowIfNull(values);

        var required = requiredFieldCodes
            .Select(code => code.Trim())
            .Where(code => code.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        var unknownRequired = required.FirstOrDefault(code => scheme.FindByCode(code) is null);
        if (unknownRequired is not null)
        {
            throw new DomainException(
                "taskmgmt.transition_required_field_unknown",
                $"Przejście wymaga pola `{unknownRequired}`, którego nie ma w schemacie `{scheme.Name}`.");
        }

        var unknownValue = values.Keys.FirstOrDefault(code => scheme.FindByCode(code) is null);
        if (unknownValue is not null)
        {
            throw new DomainException(
                "taskmgmt.field_unknown",
                $"Pole `{unknownValue}` nie należy do schematu pól `{scheme.Name}`.");
        }

        var merged = _customFields.ToDictionary(pair => pair.Key, pair => (string?)pair.Value, StringComparer.Ordinal);
        foreach (var (code, value) in values)
        {
            merged[code] = value;
        }

        var missing = required.FirstOrDefault(code => !merged.TryGetValue(code, out var value) || string.IsNullOrWhiteSpace(value));
        if (missing is not null)
        {
            throw new DomainException(
                "taskmgmt.transition_required_field_missing",
                $"Przejście wymaga wartości pola `{missing}`.");
        }

        // SetCustomFields najpierw parsuje wszystkie wartości, a dopiero później zmienia stan,
        // więc zachowujemy atomowość również dla przejścia tablicy/batcha.
        SetCustomFields(scheme, merged, now);
    }

    private void ClearSlots()
    {
        Num1 = Num2 = Num3 = Num4 = null;
        Text1 = Text2 = Text3 = Text4 = null;
        Date1 = Date2 = Date3 = Date4 = null;
        User1 = User2 = null;
    }

    private void WriteSlot(FieldSlot slot, CustomFieldValue value)
    {
        switch (slot)
        {
            case FieldSlot.Num1: Num1 = value.Number; break;
            case FieldSlot.Num2: Num2 = value.Number; break;
            case FieldSlot.Num3: Num3 = value.Number; break;
            case FieldSlot.Num4: Num4 = value.Number; break;
            case FieldSlot.Text1: Text1 = value.Text; break;
            case FieldSlot.Text2: Text2 = value.Text; break;
            case FieldSlot.Text3: Text3 = value.Text; break;
            case FieldSlot.Text4: Text4 = value.Text; break;
            case FieldSlot.Date1: Date1 = value.Date; break;
            case FieldSlot.Date2: Date2 = value.Date; break;
            case FieldSlot.Date3: Date3 = value.Date; break;
            case FieldSlot.Date4: Date4 = value.Date; break;
            case FieldSlot.User1: User1 = value.User; break;
            case FieldSlot.User2: User2 = value.User; break;
            default: break;
        }
    }

    /// <summary>
    /// Ustawia albo zdejmuje rodzica w hierarchii.
    ///
    /// <para>Rodzic wchodzi <b>obiektem</b>, nie identyfikatorem: reguła „rodzic i dziecko są
    /// w tym samym projekcie" wymaga jego stanu, a agregat nie ma jak sam sięgnąć poza swoją
    /// granicę. Przeniesienie rodzica do innego projektu przenosi dzieci (§8.3), więc
    /// hierarchia rozpięta między projektami nigdy nie powstaje legalnie.</para>
    ///
    /// <para><b>Cyklu ta metoda NIE sprawdza</b> i to jest świadome: „czy nowy rodzic jest moim
    /// potomkiem" to pytanie o całe drzewo, czyli o dane spoza agregatu. Odpowiada na nie
    /// <c>IssueParentCycleRule</c> rekurencyjnym CTE, a handler komendy powtarza je jako drugą
    /// linię obrony — dokładnie tak samo, jak przy grafie ról w Identity (§8.2).</para>
    /// </summary>
    public void SetParent(Issue? parent, DateTimeOffset now)
    {
        if (parent is null)
        {
            ParentUuid = null;
            Touch(now);
            return;
        }

        if (parent.Uuid == Uuid)
        {
            throw new DomainException(
                "taskmgmt.parent_self",
                "Zgłoszenie nie może być swoim własnym rodzicem.");
        }

        if (parent.ProjectUuid != ProjectUuid)
        {
            throw new DomainException(
                "taskmgmt.parent_other_project",
                "Rodzic musi należeć do tego samego projektu, co zgłoszenie.");
        }

        ParentUuid = parent.Uuid;
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
