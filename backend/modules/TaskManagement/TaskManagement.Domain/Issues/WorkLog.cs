using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues;

/// <summary>Wpis pracy przy zgłoszeniu. To materiał do szacowania projektu, a nie ewidencja czasu pracy.</summary>
public sealed class WorkLog : AggregateRoot
{
    private WorkLog() { }

    private WorkLog(Guid uuid, Guid issueUuid, Guid authorUuid, int minutes, string? note, DateTimeOffset loggedAt, DateTimeOffset createdAt)
        : base(uuid)
    {
        IssueUuid = issueUuid;
        AuthorUuid = authorUuid;
        Minutes = minutes;
        Note = note;
        LoggedAt = loggedAt;
        CreatedAt = createdAt;
    }

    public Guid IssueUuid { get; private set; }
    public Guid AuthorUuid { get; private set; }
    public int Minutes { get; private set; }
    public string? Note { get; private set; }
    public DateTimeOffset LoggedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    public static WorkLog Create(Guid issueUuid, Guid authorUuid, int minutes, string? note, DateTimeOffset loggedAt, DateTimeOffset now)
    {
        if (issueUuid == Guid.Empty || authorUuid == Guid.Empty)
            throw new DomainException("taskmgmt.work_log_owner_empty", "Wpis pracy musi wskazywać zgłoszenie i autora.");
        if (minutes is < 1 or > 24 * 60)
            throw new DomainException("taskmgmt.work_log_minutes_invalid", "Czas pracy musi mieścić się między 1 a 1440 minut.");

        return new WorkLog(NewUuid(), issueUuid, authorUuid, minutes,
            string.IsNullOrWhiteSpace(note) ? null : note.Trim(), loggedAt, now);
    }
}
