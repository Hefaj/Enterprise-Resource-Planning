using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.IssueTypes;

/// <summary>
/// Jeden typ zgłoszenia w obrębie schematu (<see cref="IssueTypeScheme"/>) — <c>Epik</c>,
/// <c>Zadanie</c>, <c>Błąd</c>... Typ steruje hierarchią przez <see cref="Category"/>,
/// a opcjonalnie zawęża konfigurację zgłoszenia: inny automat stanów albo inny zestaw pól
/// niż domyślny na projekcie (<c>docs/backend/task-management-requirements.md</c> TYP-001/003).
/// </summary>
public sealed class IssueType : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private IssueType()
    {
    }

    private IssueType(
        Guid uuid,
        Guid schemeUuid,
        string code,
        string name,
        string? nameKey,
        string icon,
        IssueTypeCategory category,
        int orderNo,
        Guid? workflowSchemeUuid,
        Guid? fieldSchemeUuid)
        : base(uuid)
    {
        SchemeUuid = schemeUuid;
        Code = code;
        Name = name;
        NameKey = nameKey;
        Icon = icon;
        Category = category;
        OrderNo = orderNo;
        WorkflowSchemeUuid = workflowSchemeUuid;
        FieldSchemeUuid = fieldSchemeUuid;
    }

    public Guid SchemeUuid { get; private set; }

    /// <summary>Kod typu — stabilny identyfikator używany w konfiguracji (np. mapowaniu
    /// typu na ikonę we froncie), niezmienny po utworzeniu.</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>Nazwa wpisana wprost przez użytkownika zakładającego typ z UI (<c>FLD-002</c>).
    /// Typy systemowe z seeda mają dodatkowo <see cref="NameKey"/> pod tłumaczenie —
    /// gdy oba są ustawione, front pokazuje tłumaczenie, nie <see cref="Name"/>.</summary>
    public string Name { get; private set; } = string.Empty;

    public string? NameKey { get; private set; }

    /// <summary>Nazwa ikony z zestawu TaigaUI — front nie zgaduje ikony po kategorii,
    /// bo dwa typy `Standard` (np. „Zadanie” i „Historyjka”) mają różne ikony.</summary>
    public string Icon { get; private set; } = string.Empty;

    public IssueTypeCategory Category { get; private set; }

    public int OrderNo { get; private set; }

    /// <summary>Nadpisanie automatu stanów projektu. <c>null</c> — typ używa schematu
    /// z projektu, tak jak dziś robią to wszystkie zgłoszenia.</summary>
    public Guid? WorkflowSchemeUuid { get; private set; }

    /// <summary>Zawężenie zestawu pól projektu. <c>null</c> — typ używa schematu pól
    /// z projektu bez zmian.</summary>
    public Guid? FieldSchemeUuid { get; private set; }

    internal static IssueType Create(
        Guid uuid,
        Guid schemeUuid,
        string code,
        string name,
        string? nameKey,
        string icon,
        IssueTypeCategory category,
        int orderNo,
        Guid? workflowSchemeUuid,
        Guid? fieldSchemeUuid)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new DomainException("taskmgmt.issue_type_code_empty", "Kod typu zgłoszenia nie może być pusty.");
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.issue_type_name_empty", "Nazwa typu zgłoszenia nie może być pusta.");
        }

        return new IssueType(
            uuid,
            schemeUuid,
            code.Trim(),
            name.Trim(),
            string.IsNullOrWhiteSpace(nameKey) ? null : nameKey.Trim(),
            icon,
            category,
            orderNo,
            workflowSchemeUuid == Guid.Empty ? null : workflowSchemeUuid,
            fieldSchemeUuid == Guid.Empty ? null : fieldSchemeUuid);
    }

    internal void SetDetails(string name, string? nameKey, string icon, int orderNo)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.issue_type_name_empty", "Nazwa typu zgłoszenia nie może być pusta.");
        }

        Name = name.Trim();
        NameKey = string.IsNullOrWhiteSpace(nameKey) ? null : nameKey.Trim();
        Icon = icon;
        OrderNo = orderNo;
    }

    internal void SetSchemeOverrides(Guid? workflowSchemeUuid, Guid? fieldSchemeUuid)
    {
        WorkflowSchemeUuid = workflowSchemeUuid == Guid.Empty ? null : workflowSchemeUuid;
        FieldSchemeUuid = fieldSchemeUuid == Guid.Empty ? null : fieldSchemeUuid;
    }
}
