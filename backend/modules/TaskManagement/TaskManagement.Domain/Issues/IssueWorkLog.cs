using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues;

/// <summary>
/// Wpis czasu (<c>TIME-001</c>) — agregat własny, wzorem <see cref="IssueComment"/>, nie
/// kolekcja podrzędna <see cref="Issue"/>: zgłoszenie żyjące rok potrafi zebrać setki wpisów,
/// a <c>IIssueRepository.FindAsync</c> nie może rosnąć wraz z nimi przy każdej komendzie
/// zgłoszenia — dokładnie ten sam powód, dla którego komentarze mają własne repozytorium.
///
/// <para>Usunięcie jest <b>twarde</b> — w odróżnieniu od komentarza wpis czasu nie ma niczego
/// przyczepionego (żadnych odpowiedzi), więc nie ma czego zachowywać; ślad zostaje w historii
/// zgłoszenia, tak jak przy odpięciu tagu czy powiązania.</para>
/// </summary>
public sealed class IssueWorkLog : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private IssueWorkLog()
    {
    }

    private IssueWorkLog(
        Guid uuid,
        Guid issueUuid,
        Guid userUuid,
        Guid workTypeUuid,
        DateOnly loggedOn,
        int minutes,
        string? description,
        DateTimeOffset createdAt) : base(uuid)
    {
        IssueUuid = issueUuid;
        UserUuid = userUuid;
        WorkTypeUuid = workTypeUuid;
        LoggedOn = loggedOn;
        Minutes = minutes;
        Description = description;
        CreatedAt = createdAt;
    }

    public Guid IssueUuid { get; private set; }

    public Guid UserUuid { get; private set; }

    public Guid WorkTypeUuid { get; private set; }

    public DateOnly LoggedOn { get; private set; }

    public int Minutes { get; private set; }

    public string? Description { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static IssueWorkLog CreateWithUuid(
        Guid uuid,
        Guid issueUuid,
        Guid userUuid,
        Guid workTypeUuid,
        DateOnly loggedOn,
        int minutes,
        string? description,
        DateTimeOffset createdAt)
    {
        if (issueUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.work_log_issue_empty", "Wpis czasu musi należeć do zgłoszenia.");
        }

        if (userUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.work_log_user_empty", "Wpis czasu musi należeć do osoby.");
        }

        if (workTypeUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.work_log_kind_empty", "Wpis czasu musi mieć rodzaj pracy.");
        }

        if (minutes <= 0)
        {
            throw new DomainException("taskmgmt.work_log_minutes_invalid", "Czas wpisu musi być dodatni.");
        }

        return new IssueWorkLog(
            uuid,
            issueUuid,
            userUuid,
            workTypeUuid,
            loggedOn,
            minutes,
            string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            createdAt);
    }
}
