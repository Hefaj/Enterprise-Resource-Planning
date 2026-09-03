namespace TaskManagement.Domain.Automation;

/// <summary>Wynik jednego uruchomienia reguły — patrz <see cref="AutomationRun"/>.</summary>
public enum AutomationRunOutcome
{
    Executed = 0,
    Failed = 1,
}
