using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Automation;

/// <summary>
/// Jedna akcja reguły automatyzacji — encja podrzędna <see cref="AutomationRule"/>, nie osobny
/// agregat (żyje wyłącznie w kontekście swojej reguły, jak <c>WorkflowTransition</c> w
/// <c>WorkflowScheme</c>). <see cref="ConfigJson"/> jest małym, typowanym ładunkiem per
/// <see cref="Kind"/> (np. <c>{"priority":"High"}</c>) — interpretuje go silnik wykonawczy
/// (Application), nie ten agregat.
/// </summary>
public sealed class AutomationAction : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private AutomationAction()
    {
    }

    private AutomationAction(Guid uuid, Guid ruleUuid, AutomationActionKind kind, string configJson, int orderNo)
        : base(uuid)
    {
        RuleUuid = ruleUuid;
        Kind = kind;
        ConfigJson = configJson;
        OrderNo = orderNo;
    }

    /// <summary>Klucz obcy do reguły-rodzica — wzorem <c>WorkflowTransition.SchemeUuid</c>.
    /// Nadawany przez <see cref="AutomationRule"/> przy budowaniu kolekcji, nie przez samo
    /// wywołanie <see cref="Create"/> z zewnątrz agregatu.</summary>
    public Guid RuleUuid { get; private set; }

    public AutomationActionKind Kind { get; private set; }

    public string ConfigJson { get; private set; } = "{}";

    public int OrderNo { get; private set; }

    public static AutomationAction Create(
        Guid uuid, Guid ruleUuid, AutomationActionKind kind, string? configJson, int orderNo)
        => new(uuid, ruleUuid, kind, string.IsNullOrWhiteSpace(configJson) ? "{}" : configJson.Trim(), orderNo);
}
