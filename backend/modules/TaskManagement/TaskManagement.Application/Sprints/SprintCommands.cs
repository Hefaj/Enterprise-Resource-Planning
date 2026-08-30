using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.Sprints;

namespace TaskManagement.Application.Sprints;

public sealed class SprintCreateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
    public Guid BoardUuid { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly StartOn { get; set; }
    public DateOnly EndOn { get; set; }
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
        var board = await _boards.FindAsync(command.BoardUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Board), command.BoardUuid);
        if (board.Mode != BoardMode.Scrum)
        {
            throw new DomainException("taskmgmt.sprint_board_not_scrum", "Sprint można utworzyć wyłącznie na tablicy Scrum.");
        }

        var sprint = Sprint.CreateWithUuid(command.Uuid, board.Uuid, command.Name, command.StartOn, command.EndOn);
        _sprints.Add(sprint);
        return sprint.Uuid;
    }
}

public sealed class SprintStartCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
}

public sealed class SprintStartCommandHandler : CommandHandler<SprintStartCommand, Guid>
{
    private readonly ISprintRepository _sprints;
    public SprintStartCommandHandler(ISprintRepository sprints) => _sprints = sprints;

    public override async Task<Guid> ExecuteAsync(SprintStartCommand command, CancellationToken ct = default)
    {
        var sprint = await _sprints.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Sprint), command.Uuid);
        sprint.Start();
        return sprint.Uuid;
    }
}

/// <summary>Przypisuje zgłoszenie do sprintu (lub zdejmuje je do backlogu). Celem wsadu jest
/// zgłoszenie, dzięki czemu operacja działa także przez <c>targetFilter</c> listy zgłoszeń.</summary>
public sealed class SprintSetIssueSprintCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
    public Guid BoardUuid { get; set; }
    public Guid? SprintUuid { get; set; }
}

public sealed class SprintSetIssueSprintCommandHandler : CommandHandler<SprintSetIssueSprintCommand, Guid>
{
    private readonly IBoardRepository _boards;
    private readonly IBoardCardRepository _cards;
    private readonly ISprintRepository _sprints;
    private readonly IClock _clock;

    public SprintSetIssueSprintCommandHandler(IBoardRepository boards, IBoardCardRepository cards, ISprintRepository sprints, IClock clock)
    {
        _boards = boards;
        _cards = cards;
        _sprints = sprints;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(SprintSetIssueSprintCommand command, CancellationToken ct = default)
    {
        var board = await _boards.FindAsync(command.BoardUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Board), command.BoardUuid);
        if (board.Mode != BoardMode.Scrum)
        {
            throw new DomainException("taskmgmt.sprint_board_not_scrum", "Backlog i sprinty działają wyłącznie na tablicy Scrum.");
        }

        if (command.SprintUuid is { } sprintUuid)
        {
            var sprint = await _sprints.FindAsync(sprintUuid, ct).ConfigureAwait(false)
                ?? throw new AggregateNotFoundException(nameof(Sprint), sprintUuid);
            if (sprint.BoardUuid != board.Uuid || sprint.Status == SprintStatus.Closed)
            {
                throw new DomainException("taskmgmt.sprint_issue_assignment_invalid", "Zgłoszenie można przypisać tylko do otwartego sprintu tej samej tablicy.");
            }
        }

        var cards = await _cards.MaterializeBoardAsync(board.Uuid, _clock.UtcNow, ct).ConfigureAwait(false);
        var card = cards.FirstOrDefault(card => card.IssueUuid == command.Uuid)
            ?? throw new AggregateNotFoundException("BoardCard", command.Uuid);
        card.SetSprint(command.SprintUuid, _clock.UtcNow);
        return command.Uuid;
    }
}

public enum SprintCloseOpenIssuesDisposition { Backlog = 0, NextSprint = 1 }

/// <summary>Zamyka sprint wyłącznie z jawną decyzją o niedokończonych zgłoszeniach.</summary>
public sealed class SprintCloseCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }
    public SprintCloseOpenIssuesDisposition OpenIssuesDisposition { get; set; }
    public Guid? NextSprintUuid { get; set; }
}

public sealed class SprintCloseCommandHandler : CommandHandler<SprintCloseCommand, Guid>
{
    private readonly ISprintRepository _sprints;
    private readonly IBoardCardRepository _cards;
    private readonly IClock _clock;

    public SprintCloseCommandHandler(ISprintRepository sprints, IBoardCardRepository cards, IClock clock)
    {
        _sprints = sprints;
        _cards = cards;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(SprintCloseCommand command, CancellationToken ct = default)
    {
        var sprint = await _sprints.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Sprint), command.Uuid);
        Guid? destination = null;
        if (command.OpenIssuesDisposition == SprintCloseOpenIssuesDisposition.NextSprint)
        {
            destination = command.NextSprintUuid ?? throw new DomainException("taskmgmt.sprint_close_destination_required", "Wskaż następny sprint albo wybierz backlog.");
            var next = await _sprints.FindAsync(destination.Value, ct).ConfigureAwait(false)
                ?? throw new AggregateNotFoundException(nameof(Sprint), destination.Value);
            if (next.BoardUuid != sprint.BoardUuid || next.Status == SprintStatus.Closed)
            {
                throw new DomainException("taskmgmt.sprint_close_destination_invalid", "Następny sprint musi być otwarty i należeć do tej samej tablicy.");
            }
        }

        foreach (var card in await _cards.GetOpenInSprintAsync(sprint.Uuid, ct).ConfigureAwait(false))
        {
            card.SetSprint(destination, _clock.UtcNow);
        }

        sprint.Close();
        return sprint.Uuid;
    }
}
