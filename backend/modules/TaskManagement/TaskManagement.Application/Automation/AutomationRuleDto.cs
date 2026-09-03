using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Automation.Conditions;

namespace TaskManagement.Application.Automation;

/// <summary>Akcja reguły w odczycie — <see cref="ConfigJson"/> zostaje opaque dla API (patrz
/// <see cref="AutomationActionRequest"/>), interpretuje go dopiero silnik wykonawczy.</summary>
public sealed record AutomationActionDto(Guid Uuid, AutomationActionKind Kind, string ConfigJson, int OrderNo);

/// <summary>Reguła automatyzacji w odczycie (AUT-001). <see cref="ConditionGroups"/> to ta sama
/// struktura, którą UI wysyła przy zapisie — front nigdy nie widzi surowego
/// <c>AutomationRule.ConditionJson</c>. <see cref="ExecutedCount"/> to <c>COUNT(*)</c> po
/// <see cref="AutomationRun"/> (AUT-002 AC1) — nie mutowalne pole agregatu.</summary>
public sealed record AutomationRuleDto(
    Guid Uuid,
    Guid ProjectUuid,
    string Name,
    AutomationTriggerKind TriggerKind,
    IReadOnlyList<IReadOnlyList<AutomationComparison>> ConditionGroups,
    IReadOnlyList<AutomationActionDto> Actions,
    bool IsEnabled,
    int ExecutedCount,
    DateTimeOffset CreatedAt);

/// <summary>Wpis logu uruchomienia reguły (AUT-002 AC1).</summary>
public sealed record AutomationRunDto(
    Guid Uuid,
    Guid RuleUuid,
    Guid IssueUuid,
    AutomationRunOutcome Outcome,
    string? ErrorMessage,
    DateTimeOffset OccurredAt);

public sealed class SearchAutomationRuleRequest
{
    public Guid ProjectUuid { get; set; }
}

/// <summary>Odczyty reguł automatyzacji.</summary>
public interface IAutomationRuleQueries
{
    Task<List<AutomationRuleDto>> SearchAsync(SearchAutomationRuleRequest request, CancellationToken cancellationToken);

    /// <summary>Ostatnie N uruchomień reguły, najnowsze pierwsze — panel „Log uruchomień".</summary>
    Task<List<AutomationRunDto>> GetRecentRunsAsync(Guid ruleUuid, int limit, CancellationToken cancellationToken);
}
