using Erp.BuildingBlocks.Domain;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Domain.Automation.Conditions;

/// <summary>
/// Waliduje warunek reguły przy zapisie — pole spoza <see cref="AutomationFieldPath.All"/>,
/// operator niepasujący do rodzaju pola (np. „większy niż" na uuid) albo literał, który się nie
/// parsuje, odrzuca się <b>tutaj</b>, nie przy każdym uruchomieniu reguły
/// (<see cref="AutomationConditionEvaluator"/> ufa już zwalidowanemu AST).
/// </summary>
public static class AutomationConditionValidator
{
    public static void Validate(AutomationCondition condition)
    {
        ArgumentNullException.ThrowIfNull(condition);

        foreach (var group in condition.Groups)
        {
            if (group.Count == 0)
            {
                throw new DomainException(
                    "taskmgmt.automation_condition_group_empty",
                    "Grupa warunku (AND) nie może być pusta.");
            }

            foreach (var comparison in group)
            {
                ValidateComparison(comparison);
            }
        }
    }

    private static void ValidateComparison(AutomationComparison comparison)
    {
        if (!AutomationFieldPath.All.Contains(comparison.FieldPath))
        {
            throw new DomainException(
                "taskmgmt.automation_condition_unknown_field",
                $"Pole `{comparison.FieldPath}` nie jest dostępne w warunku reguły.");
        }

        if (AutomationFieldPath.ReferenceFields.Contains(comparison.FieldPath)
            && comparison.Operator is not (AutomationComparisonOperator.Eq or AutomationComparisonOperator.Ne))
        {
            throw new DomainException(
                "taskmgmt.automation_condition_operator_not_supported",
                $"Pole `{comparison.FieldPath}` wspiera wyłącznie porównanie na równość/różność.");
        }

        if (AutomationFieldPath.ReferenceFields.Contains(comparison.FieldPath) && !Guid.TryParse(comparison.Literal, out _))
        {
            throw new DomainException(
                "taskmgmt.automation_condition_literal_invalid",
                $"Wartość `{comparison.Literal}` dla pola `{comparison.FieldPath}` musi być identyfikatorem.");
        }

        if (comparison.FieldPath == AutomationFieldPath.Priority
            && !Enum.TryParse<IssuePriority>(comparison.Literal, ignoreCase: true, out _))
        {
            throw new DomainException(
                "taskmgmt.automation_condition_literal_invalid",
                $"Wartość `{comparison.Literal}` nie jest znanym priorytetem.");
        }

        if (comparison.FieldPath == AutomationFieldPath.StateCategory
            && !Enum.TryParse<WorkflowStateCategory>(comparison.Literal, ignoreCase: true, out _))
        {
            throw new DomainException(
                "taskmgmt.automation_condition_literal_invalid",
                $"Wartość `{comparison.Literal}` nie jest znaną kategorią stanu.");
        }
    }
}
