using Erp.BuildingBlocks.Domain;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.IssueTypes;
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
        Guid typeUuid,
        Guid stateUuid,
        Guid reporterUuid,
        DateTimeOffset createdAt)
        : base(uuid)
    {
        ProjectUuid = projectUuid;
        Key = key;
        Title = title;
        TypeUuid = typeUuid;
        StateUuid = stateUuid;
        ReporterUuid = reporterUuid;
        Priority = IssuePriority.Normal;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public Guid ProjectUuid { get; private set; }

    /// <summary>Typ zgłoszenia — steruje hierarchią (<see cref="SetParent"/>), wymagany
    /// (TYP-001). Zmiana schematu stanów przy zmianie typu idzie osobną ścieżką w handlerze
    /// komendy, bo wymaga mapowania stanu na nowym schemacie (TYP-003 AC2) — agregat sam
    /// nie ma jak zgadnąć odpowiednika.</summary>
    public Guid TypeUuid { get; private set; }

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
        IssueType issueType,
        Guid reporterUuid,
        DateTimeOffset createdAt)
    {
        ArgumentNullException.ThrowIfNull(scheme);
        ArgumentNullException.ThrowIfNull(issueType);

        if (projectUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.issue_project_empty", "Zgłoszenie musi należeć do projektu.");
        }

        if (string.IsNullOrWhiteSpace(key))
        {
            throw new DomainException("taskmgmt.issue_key_empty", "Zgłoszenie musi mieć klucz czytelny.");
        }

        return new Issue(
            uuid,
            projectUuid,
            key.Trim(),
            ValidateTitle(title),
            issueType.Uuid,
            scheme.InitialState().Uuid,
            reporterUuid,
            createdAt);
    }

    /// <summary>
    /// Zmiana typu wg schematu projektu. Mapowanie stanu na inny schemat stanów (gdy nowy typ
    /// nadpisuje automat) robi wołający <b>przed</b> tym wywołaniem — agregat tu tylko
    /// podmienia typ i sprawdza, że należy do schematu (TYP-003 AC2).
    /// </summary>
    public void SetType(IssueTypeScheme scheme, Guid typeUuid, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(scheme);

        if (!scheme.HasType(typeUuid))
        {
            throw new DomainException(
                "taskmgmt.issue_type_unknown",
                $"Typ {typeUuid} nie należy do schematu `{scheme.Name}`.");
        }

        TypeUuid = typeUuid;
        Touch(now);
    }

    /// <summary>
    /// Zmiana typu wraz z migracją stanu na inny schemat stanów (TYP-003 AC2).
    ///
    /// <para>Gdy nowy typ nadpisuje automat inny niż stary, bieżący <see cref="StateUuid"/> nie
    /// ma odpowiednika w nowym schemacie — <paramref name="targetWorkflowScheme"/> niesie ten
    /// nowy schemat i stan ustawia się wprost na jego <c>InitialState()</c>, z pominięciem
    /// <see cref="SetState"/>: przejście między dwoma stanami z różnych schematów nie istnieje
    /// w żadnym z nich, więc walidacja przejścia zawsze by je odrzuciła. Ta sama mechanika,
    /// co przy zmianie projektu w <see cref="MoveToProject"/>. Wołający rozstrzyga, czy migracja
    /// jest potrzebna — porównując efektywny schemat starego i nowego typu — i przekazuje
    /// <c>null</c>, gdy nie jest (TYP-003 AC1: brak wskazania własnego schematu to dziedziczenie
    /// po projekcie, a nie różnica).</para>
    /// </summary>
    public void SetType(IssueTypeScheme scheme, Guid typeUuid, WorkflowScheme? targetWorkflowScheme, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(scheme);

        if (!scheme.HasType(typeUuid))
        {
            throw new DomainException(
                "taskmgmt.issue_type_unknown",
                $"Typ {typeUuid} nie należy do schematu `{scheme.Name}`.");
        }

        TypeUuid = typeUuid;

        if (targetWorkflowScheme is not null)
        {
            StateUuid = targetWorkflowScheme.InitialState().Uuid;
        }

        Touch(now);
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

        // Backstop WF-004: front sprawdza to samo PRZED wysłaniem komendy (modal zbierający
        // brakujące pola), ale agregat waliduje PRZED zmianą stanu niezależnie od frontu —
        // klient API pomijający UI albo wyścig dwóch żądań nie może obejść wymogu.
        var transition = scheme.FindTransition(StateUuid, toStateUuid);
        var missingField = transition?.RequiredFields.FirstOrDefault(
            code => !_customFields.TryGetValue(code, out var value) || string.IsNullOrWhiteSpace(value));

        if (missingField is not null)
        {
            throw new DomainException(
                "taskmgmt.required_fields_missing",
                $"Przejście `{transition!.NameKey}` wymaga wartości pola `{missingField}`.");
        }

        StateUuid = toStateUuid;
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
    /// <summary>
    /// <para>Kategorie typów wchodzą parametrami z tego samego powodu, co <paramref name="parent"/>
    /// jako obiekt: agregat nie ma jak sam sięgnąć po <see cref="IssueTypeScheme"/>, żeby
    /// zamienić <see cref="TypeUuid"/> na kategorię. Wołający (handler komendy) rozwiązuje
    /// oba typy raz i przekazuje wynik — tak samo, jak dzieje się to dla schematu stanów
    /// w <see cref="SetState"/> (TYP-001, LNK-001 AC2).</para>
    /// </summary>
    public void SetParent(Issue? parent, IssueTypeCategory thisTypeCategory, IssueTypeCategory? parentTypeCategory, DateTimeOffset now)
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

        if (thisTypeCategory == IssueTypeCategory.Epic)
        {
            throw new DomainException(
                "taskmgmt.parent_epic_cannot_have_parent",
                "Zgłoszenie typu z kategorii Epik nie może mieć rodzica.");
        }

        if (parentTypeCategory == IssueTypeCategory.Subtask)
        {
            throw new DomainException(
                "taskmgmt.parent_subtask_cannot_be_parent",
                "Zgłoszenie typu z kategorii Podzadanie nie może być rodzicem.");
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
