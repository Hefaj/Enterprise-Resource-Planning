namespace TaskManagement.Domain.Automation.Conditions;

/// <summary>
/// Pojedyncze porównanie — ścieżka do pola, operator, literał. Literał jest zawsze tekstem
/// niezależnie od typu docelowego pola (enum, uuid) — interpretację niesie
/// <see cref="AutomationFieldPath"/> danego pola, nie ten typ.
/// </summary>
public sealed record AutomationComparison(string FieldPath, AutomationComparisonOperator Operator, string Literal);
