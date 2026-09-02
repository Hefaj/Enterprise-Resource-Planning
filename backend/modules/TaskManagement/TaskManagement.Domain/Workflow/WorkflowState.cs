using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Workflow;

/// <summary>Jeden stan schematu. <see cref="NameKey"/> to <b>klucz tłumaczenia</b>, nie tekst —
/// nazwy stanów są danymi wskazującymi na registry Transloco (patrz
/// <c>docs/frontend/task-management-pages.md</c> §8).</summary>
public sealed class WorkflowState : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private WorkflowState()
    {
    }

    private WorkflowState(Guid uuid, string code, string nameKey, WorkflowStateCategory category, int orderNo)
        : base(uuid)
    {
        Code = code;
        NameKey = nameKey;
        Category = category;
        OrderNo = orderNo;
    }

    public Guid SchemeUuid { get; private set; }

    public string Code { get; private set; } = string.Empty;

    public string NameKey { get; private set; } = string.Empty;

    public WorkflowStateCategory Category { get; private set; }

    /// <summary>Kolejność w schemacie — wyznacza kolejność kolumn na tablicy i stan początkowy.</summary>
    public int OrderNo { get; private set; }

    internal static WorkflowState Create(
        Guid uuid,
        string code,
        string nameKey,
        WorkflowStateCategory category,
        int orderNo)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new DomainException("taskmgmt.workflow_state_code_empty", "Kod stanu nie może być pusty.");
        }

        return new WorkflowState(uuid, code.Trim(), nameKey, category, orderNo);
    }

    /// <summary>Nadpisuje szczegóły stanu — nazwę, kategorię i kolejność. Kod pozostaje
    /// niezmienny (wzorzec identyczny jak <see cref="IssueTypes.IssueType.SetDetails"/>),
    /// bo jest stabilnym identyfikatorem w konfiguracji.</summary>
    internal void SetDetails(string nameKey, WorkflowStateCategory category, int orderNo)
    {
        NameKey = nameKey;
        Category = category;
        OrderNo = orderNo;
    }
}
