using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Domain.Automation.Conditions;

/// <summary>
/// Ewaluuje AST warunku (już zwalidowany przez <see cref="AutomationConditionValidator"/> przy
/// zapisie reguły) względem migawki zgłoszenia. Czysta funkcja, bez I/O.
/// </summary>
public static class AutomationConditionEvaluator
{
    public static bool Evaluate(AutomationCondition condition, AutomationIssueSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(condition);
        ArgumentNullException.ThrowIfNull(snapshot);

        // DNF: pusta lista grup = zawsze prawda; w przeciwnym razie wystarczy JEDNA grupa,
        // w której WSZYSTKIE porównania są prawdziwe.
        return condition.IsAlways || condition.Groups.Any(group => group.All(c => EvaluateComparison(c, snapshot)));
    }

    private static bool EvaluateComparison(AutomationComparison comparison, AutomationIssueSnapshot snapshot)
        => comparison.FieldPath switch
        {
            AutomationFieldPath.Priority => CompareEnum(comparison, (int)snapshot.Priority,
                literal => (int)Enum.Parse<IssuePriority>(literal, ignoreCase: true)),
            AutomationFieldPath.StateCategory => CompareEnum(comparison, (int)snapshot.StateCategory,
                literal => (int)Enum.Parse<WorkflowStateCategory>(literal, ignoreCase: true)),
            AutomationFieldPath.Type => CompareGuid(comparison, snapshot.TypeUuid),
            AutomationFieldPath.State => CompareGuid(comparison, snapshot.StateUuid),
            AutomationFieldPath.Assignee => CompareNullableGuid(comparison, snapshot.AssigneeUuid),
            AutomationFieldPath.Tag => Guid.TryParse(comparison.Literal, out var tagUuid)
                && snapshot.TagUuids.Contains(tagUuid) == (comparison.Operator == AutomationComparisonOperator.Eq),
            _ => false,
        };

    private static bool CompareEnum(AutomationComparison comparison, int actual, Func<string, int> parseLiteral)
    {
        var expected = parseLiteral(comparison.Literal);

        return comparison.Operator switch
        {
            AutomationComparisonOperator.Eq => actual == expected,
            AutomationComparisonOperator.Ne => actual != expected,
            AutomationComparisonOperator.Gt => actual > expected,
            AutomationComparisonOperator.Gte => actual >= expected,
            AutomationComparisonOperator.Lt => actual < expected,
            AutomationComparisonOperator.Lte => actual <= expected,
            _ => false,
        };
    }

    private static bool CompareGuid(AutomationComparison comparison, Guid actual)
    {
        if (!Guid.TryParse(comparison.Literal, out var expected))
        {
            return false;
        }

        return comparison.Operator == AutomationComparisonOperator.Eq
            ? actual == expected
            : actual != expected;
    }

    private static bool CompareNullableGuid(AutomationComparison comparison, Guid? actual)
    {
        if (!Guid.TryParse(comparison.Literal, out var expected))
        {
            return false;
        }

        return comparison.Operator == AutomationComparisonOperator.Eq
            ? actual == expected
            : actual != expected;
    }
}
