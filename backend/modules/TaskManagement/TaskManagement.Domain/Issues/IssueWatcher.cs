using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Issues;

/// <summary>
/// Obserwator zgłoszenia — encja podrzędna <see cref="Issue"/>, wzorem
/// <c>ProjectMember</c> na <c>Project</c>.
///
/// <para><b>Rezygnacja nie usuwa wiersza.</b> <see cref="OptedOutAt"/> ustawiony oznacza jawną
/// decyzję „nie chcę tego obserwować" — kolejny komentarz albo wzmianka, które w innym wypadku
/// dopisałyby obserwatora automatycznie, muszą tę decyzję uszanować (ISS-009 AC1). Gdyby
/// rezygnacja usuwała wiersz, nie dałoby się odróżnić „nigdy nie obserwował" od „zrezygnował" —
/// a to dokładnie ta różnica decyduje, czy kolejne zdarzenie dopisze go z powrotem.</para>
/// </summary>
public sealed class IssueWatcher : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private IssueWatcher()
    {
    }

    private IssueWatcher(Guid uuid, Guid userUuid) : base(uuid)
    {
        UserUuid = userUuid;
    }

    public Guid IssueUuid { get; private set; }

    public Guid UserUuid { get; private set; }

    /// <summary>Moment jawnej rezygnacji — <c>null</c>, gdy obserwator jest aktywny.</summary>
    public DateTimeOffset? OptedOutAt { get; private set; }

    internal static IssueWatcher Create(Guid uuid, Guid userUuid)
    {
        if (userUuid == Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.issue_watcher_user_empty",
                "Obserwator zgłoszenia musi wskazywać użytkownika.");
        }

        return new IssueWatcher(uuid, userUuid);
    }

    internal void OptIn() => OptedOutAt = null;

    internal void OptOut(DateTimeOffset now) => OptedOutAt = now;
}
