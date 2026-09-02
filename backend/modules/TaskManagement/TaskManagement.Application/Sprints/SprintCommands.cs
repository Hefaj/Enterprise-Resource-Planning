using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.Sprints;

namespace TaskManagement.Application.Sprints;

/// <summary>
/// Zakłada sprint na tablicy scrumowej.
///
/// <para>Tylko tablica w trybie <see cref="BoardMode.Scrum"/> może mieć sprinty — backlog
/// i planowanie iteracji nie mają sensu na tablicy kanbanowej, gdzie praca płynie ciągle,
/// a nie porcjami (SPR-001).</para>
/// </summary>
public sealed class SprintCreateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid BoardUuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Goal { get; set; }

    public DateOnly? StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; }
}

public sealed class SprintCreateCommandHandler : CommandHandler<SprintCreateCommand, Guid>
{
    private readonly ISprintRepository _sprints;
    private readonly IBoardRepository _boards;

    public SprintCreateCommandHandler(ISprintRepository sprints, IBoardRepository boards)
    {
        _sprints = sprints;
        _boards = boards;
    }

    public override async Task<Guid> ExecuteAsync(SprintCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var board = await _boards.FindAsync(command.BoardUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Board), command.BoardUuid);

        if (board.Mode != BoardMode.Scrum)
        {
            throw new DomainException(
                "taskmgmt.sprint_board_not_scrum",
                "Sprinty istnieją tylko na tablicach w trybie scrumowym.");
        }

        var sprint = Sprint.CreateWithUuid(
            command.Uuid, command.BoardUuid, command.Name, command.Goal, command.StartsOn, command.EndsOn);

        _sprints.Add(sprint);

        return sprint.Uuid;
    }
}

/// <summary>Nadpisuje zakres dat i cel sprintu — jeden plaster planowania (SPR-001).</summary>
public sealed class SprintSetDatesCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public DateOnly? StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; }

    public string? Goal { get; set; }
}

public sealed class SprintSetDatesCommandHandler : CommandHandler<SprintSetDatesCommand, Guid>
{
    private readonly ISprintRepository _sprints;

    public SprintSetDatesCommandHandler(ISprintRepository sprints) => _sprints = sprints;

    public override async Task<Guid> ExecuteAsync(SprintSetDatesCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var sprint = await _sprints.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Sprint), command.Uuid);

        sprint.SetDates(command.StartsOn, command.EndsOn, command.Goal);

        return sprint.Uuid;
    }
}

/// <summary>Aktywuje sprint planowany. Kolizja z drugim aktywnym sprintem tej samej tablicy
/// odrzuca się indeksem bazy (SPR-001 AC1) — sprawdzenie tutaj byłoby drugim źródłem tej samej
/// reguły, rozjeżdżającym się pod dwiema równoległymi komendami.</summary>
public sealed class SprintExecStartCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class SprintExecStartCommandHandler : CommandHandler<SprintExecStartCommand, Guid>
{
    private readonly ISprintRepository _sprints;
    private readonly IClock _clock;

    public SprintExecStartCommandHandler(ISprintRepository sprints, IClock clock)
    {
        _sprints = sprints;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(SprintExecStartCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var sprint = await _sprints.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Sprint), command.Uuid);

        sprint.Start(_clock.UtcNow);

        return sprint.Uuid;
    }
}

/// <summary>
/// Zamyka sprint.
///
/// <para><see cref="MoveUnfinishedToSprintUuid"/> to jawna decyzja użytkownika, dokąd trafiają
/// niedokończone zgłoszenia — <c>null</c> oznacza backlog, uuid — konkretny następny sprint
/// (SPR-003 AC1). Nie ma trzeciej opcji „zostaw jak jest": zamknięty sprint jest tylko do
/// odczytu, więc karta zostałaby przypisana do iteracji, której nie da się już zmienić.</para>
/// </summary>
public sealed class SprintExecCloseCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid? MoveUnfinishedToSprintUuid { get; set; }
}

public sealed class SprintExecCloseCommandHandler : CommandHandler<SprintExecCloseCommand, Guid>
{
    private readonly ISprintRepository _sprints;
    private readonly IBoardCardRepository _cards;
    private readonly IClock _clock;

    public SprintExecCloseCommandHandler(ISprintRepository sprints, IBoardCardRepository cards, IClock clock)
    {
        _sprints = sprints;
        _cards = cards;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(SprintExecCloseCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var sprint = await _sprints.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Sprint), command.Uuid);

        // Ponowienie na już zamkniętym sprincie jest bez skutku — przeniesienie kart
        // wykonało się przy pierwszym wywołaniu, drugie nie ma już czego przenosić.
        if (sprint.Status == SprintStatus.Closed)
        {
            return sprint.Uuid;
        }

        if (command.MoveUnfinishedToSprintUuid is { } targetUuid)
        {
            var target = await _sprints.FindAsync(targetUuid, ct).ConfigureAwait(false)
                ?? throw new AggregateNotFoundException(nameof(Sprint), targetUuid);

            if (target.BoardUuid != sprint.BoardUuid)
            {
                throw new DomainException(
                    "taskmgmt.sprint_move_target_other_board",
                    "Niedokończone zgłoszenia można przenieść tylko do sprintu tej samej tablicy.");
            }

            if (target.Status == SprintStatus.Closed)
            {
                throw new DomainException(
                    "taskmgmt.sprint_move_target_closed",
                    "Nie da się przenieść zgłoszeń do zamkniętego sprintu.");
            }
        }

        var unfinished = await _cards.FindUnfinishedInSprintAsync(sprint.Uuid, ct).ConfigureAwait(false);

        foreach (var card in unfinished)
        {
            card.SetSprint(command.MoveUnfinishedToSprintUuid, _clock.UtcNow);
        }

        sprint.Close(_clock.UtcNow);

        return sprint.Uuid;
    }
}
