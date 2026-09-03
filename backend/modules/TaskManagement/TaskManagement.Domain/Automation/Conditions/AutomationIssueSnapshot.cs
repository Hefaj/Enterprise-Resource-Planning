using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Domain.Automation.Conditions;

/// <summary>Migawka pól zgłoszenia potrzebnych do ewaluacji warunku — odcina ewaluator od
/// całego agregatu <see cref="Issue"/>, żeby dało się go testować bez budowania zgłoszenia.</summary>
public sealed record AutomationIssueSnapshot(
    IssuePriority Priority,
    Guid TypeUuid,
    Guid StateUuid,
    WorkflowStateCategory StateCategory,
    Guid? AssigneeUuid,
    IReadOnlyCollection<Guid> TagUuids)
{
    public static AutomationIssueSnapshot Of(Issue issue)
    {
        ArgumentNullException.ThrowIfNull(issue);

        return new AutomationIssueSnapshot(
            issue.Priority,
            issue.TypeUuid,
            issue.StateUuid,
            issue.StateCategory,
            issue.AssigneeUuid,
            issue.Tags.Select(t => t.TagUuid).ToList());
    }
}
