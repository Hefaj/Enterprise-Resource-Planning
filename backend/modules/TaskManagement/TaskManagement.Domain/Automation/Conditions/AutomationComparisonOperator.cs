namespace TaskManagement.Domain.Automation.Conditions;

/// <summary>Operator porównania w wąskim języku warunku — ten sam zestaw, co `guard`
/// z WF-003/DMS §4.4 (porównania, bez wyrażeń ogólnego przeznaczenia).</summary>
public enum AutomationComparisonOperator
{
    Eq = 0,
    Ne = 1,
    Gt = 2,
    Gte = 3,
    Lt = 4,
    Lte = 5,
}
