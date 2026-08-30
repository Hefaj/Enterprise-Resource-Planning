using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Sprints;

/// <summary>
/// Iteracja należąca do jednej tablicy Scrum. Karty należące do sprintu wskazują go przez
/// <c>board_card.sprint_uuid</c>; dzięki temu backlog jest po prostu zbiorem kart bez sprintu.
/// </summary>
public sealed class Sprint : AggregateRoot
{
    private Sprint()
    {
    }

    private Sprint(Guid uuid, Guid boardUuid, string name, DateOnly startOn, DateOnly endOn)
        : base(uuid)
    {
        BoardUuid = boardUuid;
        Name = name;
        StartOn = startOn;
        EndOn = endOn;
        Status = SprintStatus.Planned;
    }

    public Guid BoardUuid { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public DateOnly StartOn { get; private set; }
    public DateOnly EndOn { get; private set; }
    public SprintStatus Status { get; private set; }

    public static Sprint CreateWithUuid(Guid uuid, Guid boardUuid, string name, DateOnly startOn, DateOnly endOn)
    {
        if (boardUuid == Guid.Empty)
        {
            throw new DomainException("taskmgmt.sprint_board_empty", "Sprint musi należeć do tablicy.");
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.sprint_name_empty", "Sprint musi mieć nazwę.");
        }

        if (endOn < startOn)
        {
            throw new DomainException("taskmgmt.sprint_date_range_invalid", "Koniec sprintu nie może być przed początkiem.");
        }

        return new Sprint(uuid, boardUuid, name.Trim(), startOn, endOn);
    }

    public void Start()
    {
        if (Status != SprintStatus.Planned)
        {
            throw new DomainException("taskmgmt.sprint_not_planned", "Uruchomić można wyłącznie zaplanowany sprint.");
        }

        Status = SprintStatus.Active;
    }

    public void Close()
    {
        if (Status != SprintStatus.Active)
        {
            throw new DomainException("taskmgmt.sprint_not_active", "Zamknąć można wyłącznie aktywny sprint.");
        }

        Status = SprintStatus.Closed;
    }
}
