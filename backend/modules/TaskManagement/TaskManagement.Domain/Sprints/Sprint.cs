using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Sprints;

/// <summary>Stan cyklu życia sprintu — brak stanu pośredniego: planowanie, jedna aktywna
/// iteracja, zamknięcie.</summary>
public enum SprintStatus
{
    Planned = 0,
    Active = 1,
    Closed = 2,
}

/// <summary>
/// Sprint — iteracja jednej tablicy scrumowej (SPR-001, <c>docs/backend/task-management.md</c> §3).
///
/// <para><b>Aktywny sprint na tablicy jest najwyżej jeden.</b> Niezmiennik egzekwuje indeks
/// częściowy bazy (<c>unique(board_uuid) where status = 'Active'</c>), nie ta klasa — dwie
/// równoległe komendy <see cref="Start"/> na dwóch różnych sprintach tej samej tablicy
/// przeszłyby walidację aplikacyjną obie.</para>
///
/// <para><b>Zamknięty sprint jest tylko do odczytu</b> (SPR-003 AC2) — jego skład zamraża się
/// na potrzeby raportu, więc <see cref="SetDates"/> po zamknięciu jest odrzucane, a nie
/// bezgłośnie ignorowane.</para>
/// </summary>
public sealed class Sprint : AggregateRoot
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private Sprint()
    {
    }

    private Sprint(Guid uuid, Guid boardUuid, string name, string? goal, DateOnly? startsOn, DateOnly? endsOn)
        : base(uuid)
    {
        BoardUuid = boardUuid;
        Name = name;
        Goal = goal;
        StartsOn = startsOn;
        EndsOn = endsOn;
        Status = SprintStatus.Planned;
    }

    public Guid BoardUuid { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string? Goal { get; private set; }

    public DateOnly? StartsOn { get; private set; }

    public DateOnly? EndsOn { get; private set; }

    public SprintStatus Status { get; private set; }

    public DateTimeOffset? ActivatedAt { get; private set; }

    public DateTimeOffset? ClosedAt { get; private set; }

    public static Sprint CreateWithUuid(
        Guid uuid,
        Guid boardUuid,
        string name,
        string? goal,
        DateOnly? startsOn,
        DateOnly? endsOn)
    {
        if (boardUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.sprint_board_empty", "Sprint musi należeć do tablicy.");
        }

        ValidateDates(startsOn, endsOn);

        return new Sprint(uuid, boardUuid, ValidateName(name), NormalizeGoal(goal), startsOn, endsOn);
    }

    /// <summary>Nadpisuje zakres dat i cel — jeden plaster planowania sprintu.</summary>
    public void SetDates(DateOnly? startsOn, DateOnly? endsOn, string? goal)
    {
        EnsureNotClosed();
        ValidateDates(startsOn, endsOn);

        StartsOn = startsOn;
        EndsOn = endsOn;
        Goal = NormalizeGoal(goal);
    }

    /// <summary>Aktywuje sprint. Wołanie na już aktywnym sprincie jest bez skutku — idempotencja
    /// pod ponowienie komendy, nie zaproszenie do aktywowania dwa razy z rzędu z dwoma różnymi
    /// znaczeniami.</summary>
    public void Start(DateTimeOffset now)
    {
        if (Status == SprintStatus.Active)
        {
            return;
        }

        if (Status != SprintStatus.Planned)
        {
            throw new DomainException(
                "taskmgmt.sprint_not_plannable",
                "Tylko planowany sprint może zostać aktywowany.");
        }

        Status = SprintStatus.Active;
        ActivatedAt = now;
    }

    /// <summary>Zamyka sprint. Przeniesienie niedokończonych zgłoszeń jest odpowiedzialnością
    /// wywołującego (handler komendy <c>SprintExecClose</c>) — agregat sprintu nie widzi kart
    /// tablicy, więc nie może podjąć za użytkownika decyzji, dokąd mają trafić (SPR-003 AC1).</summary>
    public void Close(DateTimeOffset now)
    {
        if (Status == SprintStatus.Closed)
        {
            return;
        }

        if (Status != SprintStatus.Active)
        {
            throw new DomainException(
                "taskmgmt.sprint_not_active",
                "Tylko aktywny sprint może zostać zamknięty.");
        }

        Status = SprintStatus.Closed;
        ClosedAt = now;
    }

    private void EnsureNotClosed()
    {
        if (Status == SprintStatus.Closed)
        {
            throw new DomainException(
                "taskmgmt.sprint_closed",
                "Zamknięty sprint jest tylko do odczytu — jego skład jest zamrożony na potrzeby raportu.");
        }
    }

    private static void ValidateDates(DateOnly? startsOn, DateOnly? endsOn)
    {
        if (startsOn is { } s && endsOn is { } e && e < s)
        {
            throw new DomainException(
                "taskmgmt.sprint_dates_invalid",
                "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.");
        }
    }

    private static string? NormalizeGoal(string? goal) => string.IsNullOrWhiteSpace(goal) ? null : goal.Trim();

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.sprint_name_empty", "Nazwa sprintu nie może być pusta.");
        }

        var trimmed = name.Trim();

        if (trimmed.Length > 256)
        {
            throw new DomainException("taskmgmt.sprint_name_too_long", "Nazwa może mieć najwyżej 256 znaków.");
        }

        return trimmed;
    }
}
