using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues.Events;

/// <summary>
/// Zgłoszenie przeszło do stanu kategorii <see cref="Workflow.WorkflowStateCategory.Done"/>.
///
/// <para>Zdarzenie domenowe, <b>nie integracyjne</b> — reakcja (przeliczenie
/// <see cref="Issue.DerivedDeliveryState"/> zlecenia powiązanego przez
/// <see cref="IssueLinkType.Delivers"/>) dzieje się w tym samym module i w tej samej transakcji,
/// więc nie ma powodu, żeby opuszczać proces (<c>docs/backend/task-management.md</c> §9,
/// REQ-003).</para>
/// </summary>
public sealed record IssueClosed(Guid IssueUuid, DateTimeOffset OccurredAt) : IDomainEvent;
