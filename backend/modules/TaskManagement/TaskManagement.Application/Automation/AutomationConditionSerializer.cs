using System.Text.Json;
using TaskManagement.Domain.Automation.Conditions;

namespace TaskManagement.Application.Automation;

/// <summary>
/// (De)serializacja AST warunku do/z <see cref="Domain.Automation.AutomationRule.ConditionJson"/>.
/// Front nigdy nie widzi tego tekstu — komendy i odczyty niosą strukturę
/// (<c>List&lt;List&lt;AutomationComparison&gt;&gt;</c>) wprost, ten serializator jest wyłącznie
/// formatem zapisu w bazie (ten sam podział, co gdzie indziej: opaque na wejściu/wyjściu API,
/// jawny format wewnątrz modułu).
/// </summary>
public static class AutomationConditionSerializer
{
    public static string? Serialize(AutomationCondition condition)
        => condition.IsAlways ? null : JsonSerializer.Serialize(condition.Groups);

    public static AutomationCondition Deserialize(string? conditionJson)
    {
        if (string.IsNullOrWhiteSpace(conditionJson))
        {
            return AutomationCondition.Always;
        }

        var groups = JsonSerializer.Deserialize<List<List<AutomationComparison>>>(conditionJson)
            ?? [];

        return new AutomationCondition(groups);
    }
}
