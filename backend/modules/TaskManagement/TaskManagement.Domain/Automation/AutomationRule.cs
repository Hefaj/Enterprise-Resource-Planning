using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Automation;

/// <summary>
/// Reguła automatyzacji jako dana (AUT-001) — <c>when</c> (<see cref="TriggerKind"/>) →
/// <c>if</c> (<see cref="ConditionJson"/>, wąski AST z
/// <c>TaskManagement.Domain.Automation.Conditions</c>) → <c>then</c> (<see cref="Actions"/>,
/// zamknięta lista, AC1). Agregat własny, zawsze projektowy — w odróżnieniu od
/// <c>SavedView</c> reguła nie ma sensu bez kontekstu projektu, którego zgłoszenia dotyczy.
///
/// <para>Agregat <b>nie zna</b> treści warunku poza tym, że to niepusty tekst — walidację pól
/// i operatorów robi <c>AutomationConditionValidator</c> w handlerze komendy, PRZED zapisem
/// (ten sam podział odpowiedzialności co <c>SavedView.FilterJson</c>, tyle że tu backend
/// faktycznie interpretuje ładunek przy wykonaniu, więc walidacja przy zapisie ma sens
/// biznesowy, nie tylko higieniczny).</para>
///
/// <para>Licznik wykonań i log (AUT-002 AC1) świadomie NIE są polami tego agregatu — liczy się
/// je z <see cref="AutomationRun"/> (<c>COUNT(*)</c>), żeby nie trzymać stanu, który da się
/// wyliczyć.</para>
/// </summary>
public sealed class AutomationRule : AggregateRoot
{
    private readonly List<AutomationAction> _actions = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private AutomationRule()
    {
    }

    private AutomationRule(
        Guid uuid,
        Guid projectUuid,
        string name,
        AutomationTriggerKind triggerKind,
        string? conditionJson,
        IEnumerable<AutomationAction> actions,
        DateTimeOffset createdAt) : base(uuid)
    {
        ProjectUuid = projectUuid;
        Name = name;
        TriggerKind = triggerKind;
        ConditionJson = conditionJson;
        _actions = actions.ToList();
        IsEnabled = true;
        CreatedAt = createdAt;
    }

    public Guid ProjectUuid { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public AutomationTriggerKind TriggerKind { get; private set; }

    /// <summary><c>null</c> = warunek zawsze prawdziwy (reguła bez `if`).</summary>
    public string? ConditionJson { get; private set; }

    public IReadOnlyList<AutomationAction> Actions => _actions.AsReadOnly();

    public bool IsEnabled { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static AutomationRule CreateWithUuid(
        Guid uuid,
        Guid projectUuid,
        string name,
        AutomationTriggerKind triggerKind,
        string? conditionJson,
        IEnumerable<AutomationAction> actions,
        DateTimeOffset now)
    {
        if (projectUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.automation_rule_project_missing",
                "Reguła automatyzacji musi należeć do projektu.");
        }

        var materializedActions = ValidateActions(actions);

        return new AutomationRule(
            uuid, projectUuid, ValidateName(name), triggerKind, conditionJson, materializedActions, now);
    }

    /// <summary>Nadpisuje całą treść reguły naraz — nazwę, wyzwalacz, warunek i akcje —
    /// wzorem <c>SavedView.Set</c>. Włączenie/wyłączenie idzie osobnymi metodami
    /// (<see cref="Enable"/>/<see cref="Disable"/>), bo to inny rodzaj decyzji niż edycja treści.</summary>
    public void Set(
        string name,
        AutomationTriggerKind triggerKind,
        string? conditionJson,
        IEnumerable<AutomationAction> actions)
    {
        var materializedActions = ValidateActions(actions);

        Name = ValidateName(name);
        TriggerKind = triggerKind;
        ConditionJson = conditionJson;

        _actions.Clear();
        _actions.AddRange(materializedActions);
    }

    public void Enable() => IsEnabled = true;

    public void Disable() => IsEnabled = false;

    private static List<AutomationAction> ValidateActions(IEnumerable<AutomationAction> actions)
    {
        var materialized = actions.ToList();

        if (materialized.Count == 0)
        {
            throw new DomainException(
                "taskmgmt.automation_rule_without_action",
                "Reguła automatyzacji musi mieć co najmniej jedną akcję.");
        }

        return materialized;
    }

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.automation_rule_name_empty", "Nazwa reguły nie może być pusta.");
        }

        return name.Trim();
    }
}
