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

    private Project(Guid uuid, string code, string name, ProjectKind kind, Guid workflowSchemeUuid, bool isPublic)
        : base(uuid)
    {
        Code = code;
        Name = name;
        Kind = kind;
        WorkflowSchemeUuid = workflowSchemeUuid;
        IsPublic = isPublic;
    }

    /// <summary>Prefiks klucza zgłoszeń (<c>DEV</c>, <c>MKT</c>). Zmiana prefiksu
    /// <b>nie przenumerowuje</b> istniejących zgłoszeń — patrz §4.</summary>
    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public ProjectKind Kind { get; private set; }

    public Guid WorkflowSchemeUuid { get; private set; }

    /// <summary>Projekt publiczny w organizacji — widoczny bez członkostwa.
    /// Drugi (i jedyny inny) składnik predykatu widoczności obok <see cref="Members"/>.</summary>
    public bool IsPublic { get; private set; }

    public IReadOnlyList<ProjectMember> Members => _members.AsReadOnly();

    public static Project Create(string code, string name, ProjectKind kind, Guid workflowSchemeUuid, bool isPublic)
        => CreateWithUuid(NewUuid(), code, name, kind, workflowSchemeUuid, isPublic);

    /// <summary>Odtwarza projekt o znanym identyfikatorze — dla seedera i dla komendy
    /// tworzącej, która dostaje uuid od klienta (tryb <c>Commands[]</c> operacji masowej).</summary>
    public static Project CreateWithUuid(
        Guid uuid,
        string code,
        string name,
        ProjectKind kind,
        Guid workflowSchemeUuid,
        bool isPublic)
    {
        if (workflowSchemeUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.project_workflow_scheme_empty",
                "Projekt musi wskazywać schemat stanów.");
        }

        return new Project(uuid, ValidateCode(code), ValidateName(name), kind, workflowSchemeUuid, isPublic);
    }

    public void SetName(string name) => Name = ValidateName(name);

    public void SetVisibility(bool isPublic) => IsPublic = isPublic;

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
