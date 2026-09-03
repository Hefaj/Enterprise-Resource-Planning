using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Projects;

/// <summary>
/// Projekt — właściciel konfiguracji, <b>granica widoczności i granica numeracji</b>
/// (<c>docs/backend/task-management.md</c> §3).
///
/// <para>Faza 0 niesie kod, nazwę, rodzaj, schemat stanów i członków. Schemat pól
/// (<c>FieldScheme</c>, sloty) dochodzi w fazie 3, SLA w fazie 5 — nie zakładamy kolumn
/// na zapas, bo pusty schemat pól i pusta polityka SLA nie różnią się niczym od ich braku.</para>
/// </summary>
public sealed class Project : AggregateRoot
{
    private readonly List<ProjectMember> _members = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private Project()
    {
    }

    private Project(
        Guid uuid,
        string code,
        string name,
        ProjectKind kind,
        Guid workflowSchemeUuid,
        Guid issueTypeSchemeUuid,
        bool isPublic)
        : base(uuid)
    {
        Code = code;
        Name = name;
        Kind = kind;
        WorkflowSchemeUuid = workflowSchemeUuid;
        IssueTypeSchemeUuid = issueTypeSchemeUuid;
        IsPublic = isPublic;
    }

    /// <summary>Prefiks klucza zgłoszeń (<c>DEV</c>, <c>MKT</c>). Zmiana prefiksu
    /// <b>nie przenumerowuje</b> istniejących zgłoszeń — patrz §4.</summary>
    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public ProjectKind Kind { get; private set; }

    public Guid WorkflowSchemeUuid { get; private set; }

    /// <summary>Schemat typów zgłoszeń — tak samo jak <see cref="WorkflowSchemeUuid"/>,
    /// wymagany: projekt bez typów nie da założyć żadnego zgłoszenia (TYP-001). Nowe projekty
    /// dostają domyślnie schemat systemowy z seeda; zmiana idzie przez
    /// <see cref="SetIssueTypeScheme"/>.</summary>
    public Guid IssueTypeSchemeUuid { get; private set; }

    /// <summary>
    /// Schemat pól niestandardowych. <c>null</c> znaczy „projekt bez pól własnych" i jest
    /// stanem normalnym, nie brakiem konfiguracji — zgłoszenie ma wtedy same pola wspólne.
    ///
    /// <para>Osobno od <see cref="WorkflowSchemeUuid"/>, bo to dwie niezależne osie konfiguracji:
    /// dwa projekty mogą dzielić automat stanów i mieć zupełnie inne pola (§6).</para>
    /// </summary>
    public Guid? FieldSchemeUuid { get; private set; }

    /// <summary>Projekt publiczny w organizacji — widoczny bez członkostwa.
    /// Drugi (i jedyny inny) składnik predykatu widoczności obok <see cref="Members"/>.</summary>
    public bool IsPublic { get; private set; }

    public IReadOnlyList<ProjectMember> Members => _members.AsReadOnly();

    /// <summary>Widok domyślny projektu (VIEW-002) — automatycznie stosowany na liście zgłoszeń
    /// przy wejściu w kontekst tego projektu, dopóki użytkownik nie wybierze innego widoku w
    /// bieżącej sesji. <c>null</c> to stan normalny: „projekt bez widoku domyślnego" znaczy po
    /// prostu brak filtra narzuconego z góry, tak jak <see cref="FieldSchemeUuid"/> bez wartości
    /// znaczy „bez pól własnych". Wskazany widok musi być udostępniony TEMU projektowi — walidację
    /// robi handler komendy (potrzebuje <c>SavedView</c>, osobnego agregatu), nie ta klasa.
    ///
    /// <para><b>Referencja miękka, celowo bez klucza obcego</b>: usunięcie widoku wskazanego jako
    /// domyślny (VIEW-001, każdy właściciel może usunąć swój widok w dowolnej chwili) nie ma
    /// obowiązku czyścić tego pola od razu — front, nie znajdując wskazanego uuida wśród
    /// wczytanych widoków projektu, po prostu pomija auto-zastosowanie, tak samo jak VIEW-001 AC2
    /// każe mu pomijać kod pola, którego profil już nie zna, zamiast rzucać błędem.</para></summary>
    public Guid? DefaultSavedViewUuid { get; private set; }

    /// <summary>Polityka SLA — <c>null</c> znaczy „projekt bez zdefiniowanego SLA", stan
    /// normalny, tak samo jak <see cref="FieldSchemeUuid"/> (faza 5, PRJ-006).</summary>
    public int? SlaResponseMinutes { get; private set; }

    public int? SlaResolutionMinutes { get; private set; }

    public SlaWorkingDays? SlaWorkingDays { get; private set; }

    public TimeOnly? SlaWorkStartTime { get; private set; }

    public TimeOnly? SlaWorkEndTime { get; private set; }

    /// <summary>Projekt archiwalny (PRJ-004) — tylko do odczytu, znika z domyślnych list i
    /// z wyboru przy tworzeniu zgłoszenia, ale linki do jego zgłoszeń nadal działają. Usunięcia
    /// projektu celowo nie ma (PRJ-004 AC2) — archiwizacja jest jedynym „wygaszeniem".</summary>
    public bool IsArchived { get; private set; }

    public static Project Create(
        string code,
        string name,
        ProjectKind kind,
        Guid workflowSchemeUuid,
        Guid issueTypeSchemeUuid,
        bool isPublic)
        => CreateWithUuid(NewUuid(), code, name, kind, workflowSchemeUuid, issueTypeSchemeUuid, isPublic);

    /// <summary>Odtwarza projekt o znanym identyfikatorze — dla seedera i dla komendy
    /// tworzącej, która dostaje uuid od klienta (tryb <c>Commands[]</c> operacji masowej).</summary>
    public static Project CreateWithUuid(
        Guid uuid,
        string code,
        string name,
        ProjectKind kind,
        Guid workflowSchemeUuid,
        Guid issueTypeSchemeUuid,
        bool isPublic)
    {
        if (workflowSchemeUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.project_workflow_scheme_empty",
                "Projekt musi wskazywać schemat stanów.");
        }

        if (issueTypeSchemeUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.project_issue_type_scheme_empty",
                "Projekt musi wskazywać schemat typów zgłoszeń.");
        }

        return new Project(uuid, ValidateCode(code), ValidateName(name), kind, workflowSchemeUuid, issueTypeSchemeUuid, isPublic);
    }

    public void SetName(string name) => Name = ValidateName(name);

    /// <summary>Podmienia schemat typów zgłoszeń. Zgłoszenia istniejące na starym schemacie
    /// zachowują swój <c>TypeUuid</c> — podmiana nie migruje danych wstecz, tak samo jak zmiana
    /// automatu stanów nie przenosi kart na inne kolumny (§5.3).</summary>
    public void SetIssueTypeScheme(Guid issueTypeSchemeUuid)
    {
        if (issueTypeSchemeUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.project_issue_type_scheme_empty",
                "Projekt musi wskazywać schemat typów zgłoszeń.");
        }

        IssueTypeSchemeUuid = issueTypeSchemeUuid;
    }

    public void SetVisibility(bool isPublic) => IsPublic = isPublic;

    /// <summary>Zmienia prefiks klucza (PRJ-003). Istniejące zgłoszenia zachowują swój
    /// <c>Key</c> bez zmian — wołający musi osobno podmienić prefiks w
    /// <see cref="ProjectKeyCounter"/> (§4), bo to dwa oddzielne zapisy, a licznik nie jest
    /// częścią tego agregatu.</summary>
    public void SetCode(string code) => Code = ValidateCode(code);

    /// <summary>Archiwizuje projekt — tylko do odczytu, znika z domyślnych list i z pickera
    /// przy tworzeniu zgłoszenia (PRJ-004). Odwracalne: <see cref="Unarchive"/> przywraca projekt
    /// do normalnego użytku, bo pomyłkowa archiwizacja nie może być bez wyjścia.</summary>
    public void Archive() => IsArchived = true;

    public void Unarchive() => IsArchived = false;

    /// <summary>Odmawia operacji, które projekt archiwalny ma zablokowane — dziś wyłącznie
    /// założenie nowego zgłoszenia (PRJ-004 AC1). Wołane z handlera komendy zakładającej
    /// zgłoszenie: `Project` i `Issue` to dwa różne agregaty.</summary>
    public void EnsureNotArchived()
    {
        if (IsArchived)
        {
            throw new DomainException(
                "taskmgmt.project_archived",
                $"Projekt {Code} jest zarchiwizowany — nie da się w nim założyć nowego zgłoszenia.");
        }
    }

    /// <summary>Zakłada albo aktualizuje politykę SLA (PRJ-006). Czas realizacji krótszy niż
    /// czas reakcji nie ma sensu — reakcja jest zawsze pierwszym krokiem realizacji.</summary>
    public void SetSla(
        int responseMinutes,
        int resolutionMinutes,
        SlaWorkingDays workingDays,
        TimeOnly workStartTime,
        TimeOnly workEndTime)
    {
        if (responseMinutes <= 0)
        {
            throw new DomainException("taskmgmt.sla_response_invalid", "Czas reakcji musi być dodatni.");
        }

        if (resolutionMinutes < responseMinutes)
        {
            throw new DomainException(
                "taskmgmt.sla_resolution_before_response",
                "Czas realizacji nie może być krótszy niż czas reakcji.");
        }

        if (workingDays == Projects.SlaWorkingDays.None)
        {
            throw new DomainException("taskmgmt.sla_working_days_empty", "Kalendarz roboczy musi mieć co najmniej jeden dzień.");
        }

        if (workEndTime <= workStartTime)
        {
            throw new DomainException("taskmgmt.sla_hours_invalid", "Godzina końca dnia roboczego musi być późniejsza niż godzina początku.");
        }

        SlaResponseMinutes = responseMinutes;
        SlaResolutionMinutes = resolutionMinutes;
        SlaWorkingDays = workingDays;
        SlaWorkStartTime = workStartTime;
        SlaWorkEndTime = workEndTime;
    }

    public void ClearSla()
    {
        SlaResponseMinutes = null;
        SlaResolutionMinutes = null;
        SlaWorkingDays = null;
        SlaWorkStartTime = null;
        SlaWorkEndTime = null;
    }

    /// <summary>Podpina albo odpina schemat pól. Odpięcie <b>nie kasuje</b> wartości zapisanych
    /// na zgłoszeniach — zostają w <c>custom_fields</c> i wrócą, gdy schemat wróci. Kasowanie
    /// danych przy zmianie konfiguracji jest nieodwracalne, a ta operacja nie wygląda na
    /// nieodwracalną.</summary>
    public void SetFieldScheme(Guid? fieldSchemeUuid)
        => FieldSchemeUuid = fieldSchemeUuid == Guid.Empty ? null : fieldSchemeUuid;

    /// <summary>Ustawia albo zdejmuje widok domyślny (VIEW-002). Że wskazany widok istnieje i
    /// jest udostępniony temu projektowi (nie prywatny, nie widok innego projektu) sprawdza
    /// handler komendy — agregat <c>Project</c> nie widzi <c>SavedView</c>.</summary>
    public void SetDefaultSavedView(Guid? savedViewUuid)
        => DefaultSavedViewUuid = savedViewUuid == Guid.Empty ? null : savedViewUuid;

    /// <summary>Dodaje albo aktualizuje rolę członka. Idempotentne po użytkowniku —
    /// dwukrotne dodanie tej samej osoby zmienia rolę, nie tworzy drugiego wiersza.</summary>
    public void AddMember(Guid userUuid, ProjectMemberRole role)
    {
        var existing = _members.Find(m => m.UserUuid == userUuid);
        if (existing is not null)
        {
            existing.SetRole(role);
            return;
        }

        _members.Add(ProjectMember.Create(NewUuid(), userUuid, role));
    }

    public void RemoveMember(Guid userUuid)
    {
        var existing = _members.Find(m => m.UserUuid == userUuid)
            ?? throw new DomainException(
                "taskmgmt.project_member_not_found",
                $"Użytkownik {userUuid} nie jest członkiem projektu.");

        _members.Remove(existing);
    }

    private static string ValidateCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new DomainException("taskmgmt.project_code_empty", "Kod projektu nie może być pusty.");
        }

        var trimmed = code.Trim().ToUpperInvariant();

        // Kod wchodzi do klucza czytelnego (`DEV-123`), więc myślnik jest w nim zarezerwowany
        // jako separator — inaczej `A-B-12` nie da się jednoznacznie rozłożyć z powrotem.
        if (trimmed.Contains('-', StringComparison.Ordinal))
        {
            throw new DomainException(
                "taskmgmt.project_code_invalid",
                "Kod projektu nie może zawierać myślnika — jest separatorem klucza zgłoszenia.");
        }

        if (trimmed.Length > 16)
        {
            throw new DomainException("taskmgmt.project_code_invalid", "Kod projektu może mieć najwyżej 16 znaków.");
        }

        return trimmed;
    }

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.project_name_empty", "Nazwa projektu nie może być pusta.");
        }

        return name.Trim();
    }
}
