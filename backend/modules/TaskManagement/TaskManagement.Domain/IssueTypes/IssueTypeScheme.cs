using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.IssueTypes;

/// <summary>
/// Zestaw typów zgłoszeń dostępnych w projekcie — tak samo jak <c>WorkflowScheme</c> i
/// <c>FieldScheme</c>, <b>dana, nie klasa</b>: nowy typ <c>Incydent</c> dodany z UI pojawia
/// się w modalu tworzenia zgłoszenia bez wdrożenia (<c>docs/backend/task-management-requirements.md</c>
/// TYP-002).
/// </summary>
public sealed class IssueTypeScheme : AggregateRoot
{
    private readonly List<IssueType> _types = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private IssueTypeScheme()
    {
    }

    private IssueTypeScheme(Guid uuid, string name, bool isSystem) : base(uuid)
    {
        Name = name;
        IsSystem = isSystem;
    }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Schemat systemowy — zasilany seedem, nieusuwalny z UI.</summary>
    public bool IsSystem { get; private set; }

    public IReadOnlyList<IssueType> Types => _types.AsReadOnly();

    public static IssueTypeScheme CreateWithUuid(Guid uuid, string name, bool isSystem)
        => new(uuid, ValidateName(name), isSystem);

    public void SetName(string name) => Name = ValidateName(name);

    public IssueType AddType(
        Guid uuid,
        string code,
        string name,
        string? nameKey,
        string icon,
        IssueTypeCategory category,
        int orderNo,
        Guid? workflowSchemeUuid = null,
        Guid? fieldSchemeUuid = null)
    {
        if (_types.Exists(t => string.Equals(t.Code, code, StringComparison.OrdinalIgnoreCase)))
        {
            throw new DomainException(
                "taskmgmt.issue_type_code_duplicate",
                $"Typ `{code}` już istnieje w tym schemacie.");
        }

        var type = IssueType.Create(uuid, Uuid, code, name, nameKey, icon, category, orderNo, workflowSchemeUuid, fieldSchemeUuid);
        _types.Add(type);
        return type;
    }

    public void SetType(Guid typeUuid, string name, string? nameKey, string icon, int orderNo)
        => FindOrThrow(typeUuid).SetDetails(name, nameKey, icon, orderNo);

    public void SetTypeSchemeOverrides(Guid typeUuid, Guid? workflowSchemeUuid, Guid? fieldSchemeUuid)
        => FindOrThrow(typeUuid).SetSchemeOverrides(workflowSchemeUuid, fieldSchemeUuid);

    /// <summary>
    /// Usuwa typ ze schematu. <b>Nie sprawdza użycia</b> — tak samo jak <c>FieldScheme.RemoveField</c>,
    /// bo zgłoszenia są poza granicą tego agregatu; blokadę usunięcia typu w użyciu egzekwuje
    /// <c>IssueTypeInUseRule</c> po stronie handlera (TYP-004).
    /// </summary>
    public void RemoveType(Guid typeUuid)
    {
        var type = FindOrThrow(typeUuid);
        _types.Remove(type);
    }

    public IssueType? FindByUuid(Guid typeUuid) => _types.Find(t => t.Uuid == typeUuid);

    public bool HasType(Guid typeUuid) => _types.Exists(t => t.Uuid == typeUuid);

    /// <summary>Typ domyślny nowego zgłoszenia — pierwszy w kolejności o kategorii
    /// <see cref="IssueTypeCategory.Standard"/>, tak żeby modal tworzenia nigdy nie
    /// proponował domyślnie epiku ani podzadania.</summary>
    public IssueType DefaultType()
        => _types
            .Where(t => t.Category == IssueTypeCategory.Standard)
            .OrderBy(t => t.OrderNo)
            .FirstOrDefault()
            ?? _types.OrderBy(t => t.OrderNo).FirstOrDefault()
            ?? throw new DomainException(
                "taskmgmt.issue_type_scheme_empty",
                $"Schemat `{Name}` nie ma żadnego typu zgłoszenia.");

    private IssueType FindOrThrow(Guid typeUuid)
        => FindByUuid(typeUuid)
            ?? throw new DomainException(
                "taskmgmt.issue_type_not_found",
                $"Typ {typeUuid} nie należy do schematu `{Name}`.");

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.issue_type_scheme_name_empty", "Nazwa schematu typów nie może być pusta.");
        }

        return name.Trim();
    }
}
