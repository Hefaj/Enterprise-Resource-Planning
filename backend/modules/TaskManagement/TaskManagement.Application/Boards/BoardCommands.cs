using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.Projects;

namespace TaskManagement.Application.Boards;

/// <summary>
/// Zakłada tablicę projektu. Kolumny powstają <b>z bieżącego schematu stanów</b> — po jednej
/// na stan, w kolejności ze schematu.
///
/// <para>Tablica bez kolumn nie ma czego narysować, a pytanie klienta o ich kształt przy
/// zakładaniu wymuszałoby znajomość uuid-ów stanów po stronie UI. Kolumny da się potem
/// przestawić (<see cref="BoardSetColumnsCommand"/>); edytor schematu, który zmienia je
/// u źródła, wchodzi w fazie 7.</para>
/// </summary>
public sealed class BoardCreateCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid ProjectUuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public BoardMode Mode { get; set; } = BoardMode.Kanban;

    public bool IsDefault { get; set; }
}

public sealed class BoardCreateCommandHandler : CommandHandler<BoardCreateCommand, Guid>
{
    private readonly IBoardRepository _boards;
    private readonly IWorkflowSchemeRepository _schemes;

    public BoardCreateCommandHandler(IBoardRepository boards, IWorkflowSchemeRepository schemes)
    {
        _boards = boards;
        _schemes = schemes;
    }

    public override async Task<Guid> ExecuteAsync(BoardCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var scheme = await _schemes.FindByProjectAsync(command.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), command.ProjectUuid);

        var board = Board.CreateWithUuid(command.Uuid, command.ProjectUuid, command.Name, command.Mode, command.IsDefault);

        var orderNo = 0;
        foreach (var state in scheme.States.OrderBy(s => s.OrderNo))
        {
            board.AddColumn(Entity.NewUuid(), state.Code, orderNo++, [state.Uuid]);
        }

        _boards.Add(board);

        return board.Uuid;
    }
}

/// <summary>Nadpisuje nazwę tablicy.</summary>
public sealed class BoardSetNameCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;
}

public sealed class BoardSetNameCommandHandler : CommandHandler<BoardSetNameCommand, Guid>
{
    private readonly IBoardRepository _boards;

    public BoardSetNameCommandHandler(IBoardRepository boards) => _boards = boards;

    public override async Task<Guid> ExecuteAsync(BoardSetNameCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var board = await _boards.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Board), command.Uuid);

        board.SetName(command.Name);

        return board.Uuid;
    }
}

/// <summary>Kolumna w żądaniu nadpisania układu tablicy.</summary>
public sealed class BoardColumnInput
{
    public Guid Uuid { get; set; }

    public string Name { get; set; } = string.Empty;

    public int OrderNo { get; set; }

    public List<Guid> StateUuids { get; set; } = [];

    /// <summary>Limit WIP (BRD-007) — <c>null</c> znaczy „bez limitu".</summary>
    public int? WipLimit { get; set; }
}

/// <summary>
/// Nadpisuje <b>całą</b> kolekcję kolumn — człon w liczbie mnogiej, więc to, co przyszło, jest
/// tym, co zostaje (<c>docs/backend/endpoint-naming.md</c> §2).
///
/// <para>Kolumny są nadpisywane w całości, a nie po jednej, bo przeniesienie stanu z kolumny
/// do kolumny to dwie operacje na dwóch kolumnach, a między nimi tablica byłaby w stanie
/// zabronionym przez agregat (stan w dwóch kolumnach naraz).</para>
/// </summary>
public sealed class BoardSetColumnsCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public List<BoardColumnInput> Columns { get; set; } = [];
}

public sealed class BoardSetColumnsCommandHandler : CommandHandler<BoardSetColumnsCommand, Guid>
{
    private readonly IBoardRepository _boards;
    private readonly IWorkflowSchemeRepository _schemes;

    public BoardSetColumnsCommandHandler(IBoardRepository boards, IWorkflowSchemeRepository schemes)
    {
        _boards = boards;
        _schemes = schemes;
    }

    public override async Task<Guid> ExecuteAsync(BoardSetColumnsCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var board = await _boards.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Board), command.Uuid);

        var scheme = await _schemes.FindByProjectAsync(board.ProjectUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Project), board.ProjectUuid);

        // Stan spoza schematu projektu dałby kolumnę, do której nigdy nic nie wpadnie —
        // i nikt by się o tym nie dowiedział poza pustym miejscem na tablicy.
        var unknown = command.Columns
            .SelectMany(c => c.StateUuids)
            .FirstOrDefault(s => !scheme.HasState(s));

        if (unknown != Guid.Empty)
        {
            throw new DomainException(
                "taskmgmt.board_column_unknown_state",
                $"Stan {unknown} nie należy do schematu projektu.");
        }

        foreach (var existing in board.Columns.Select(c => c.Uuid).ToList())
        {
            board.RemoveColumn(existing);
        }

        foreach (var column in command.Columns.OrderBy(c => c.OrderNo))
        {
            board.AddColumn(
                column.Uuid == Guid.Empty ? Entity.NewUuid() : column.Uuid,
                column.Name,
                column.OrderNo,
                column.StateUuids,
                column.WipLimit);
        }

        return board.Uuid;
    }
}

/// <summary>Ustawia oś grupowania wierszy tablicy (BRD-006).</summary>
public sealed class BoardSetSwimlaneCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public BoardSwimlaneMode Mode { get; set; } = BoardSwimlaneMode.None;

    /// <summary>Wymagane wyłącznie przy <see cref="BoardSwimlaneMode.CustomField"/>.</summary>
    public string? FieldCode { get; set; }
}

public sealed class BoardSetSwimlaneCommandHandler : CommandHandler<BoardSetSwimlaneCommand, Guid>
{
    private readonly IBoardRepository _boards;

    public BoardSetSwimlaneCommandHandler(IBoardRepository boards) => _boards = boards;

    public override async Task<Guid> ExecuteAsync(BoardSetSwimlaneCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var board = await _boards.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Board), command.Uuid);

        board.SetSwimlane(command.Mode, command.FieldCode);

        return board.Uuid;
    }
}

/// <summary>
/// Przestawia kartę na tablicy.
///
/// <para><b>Celem komendy jest tablica</b> (<see cref="Uuid"/>), a nie karta: kolejność należy
/// do tablicy, a karty dla danego zgłoszenia może jeszcze nie być
/// (<c>docs/backend/task-management.md</c> §7.1).</para>
///
/// <para><b>Komenda nie przyjmuje wyliczonego ranku, tylko sąsiadów</b> — rank liczy serwer,
/// w transakcji, z bieżących wartości. Gdyby liczył go klient, przestawienie na nieaktualnym
/// widoku wstawiałoby kartę w miejsce, którego użytkownik nie widział (§7.2).</para>
///
/// <para>Kolumna docelowa <b>nie jest</b> polem tej komendy. Kolumna wynika ze stanu
/// zgłoszenia, więc przeciągnięcie w bok to zwykłe <c>IssueSetState</c>, a przeciągnięcie
/// w pionie — to. Front wysyła jedno albo oba; zduplikowanie stanu w tej komendzie dałoby
/// drugie źródło prawdy o kolumnie (§7.1).</para>
/// </summary>
public sealed class BoardSetCardPositionCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid tablicy.</summary>
    public Guid Uuid { get; set; }

    public Guid IssueUuid { get; set; }

    /// <summary>Zgłoszenie, za którym karta ma wylądować. Puste = początek listy.</summary>
    public Guid? AfterIssueUuid { get; set; }

    /// <summary>Zgłoszenie, przed którym karta ma wylądować. Puste = koniec listy.</summary>
    public Guid? BeforeIssueUuid { get; set; }
}

public sealed class BoardSetCardPositionCommandHandler : CommandHandler<BoardSetCardPositionCommand, Guid>
{
    private readonly IBoardRepository _boards;
    private readonly IBoardCardRepository _cards;
    private readonly IIssueRepository _issues;
    private readonly IClock _clock;

    public BoardSetCardPositionCommandHandler(
        IBoardRepository boards,
        IBoardCardRepository cards,
        IIssueRepository issues,
        IClock clock)
    {
        _boards = boards;
        _cards = cards;
        _issues = issues;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(BoardSetCardPositionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var board = await _boards.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Board), command.Uuid);

        // Realna kolizja z §7.3: ktoś przeciągnął kartę, którą ktoś inny właśnie przeniósł
        // do innego projektu albo usunął. Nie jest nią natomiast dwoje ludzi wstawiających
        // kartę w to samo miejsce — obaj wyliczą ten sam rank i porządek `(rank, uuid)`
        // rozstrzygnie go tak samo u obojga.
        var issue = await _issues.FindAsync(command.IssueUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Domain.Issues.Issue), command.IssueUuid);

        if (issue.ProjectUuid != board.ProjectUuid)
        {
            throw new DomainException(
                "taskmgmt.board_card_other_project",
                "Zgłoszenie nie należy do projektu tej tablicy — ktoś przeniósł je w międzyczasie.");
        }

        // Pierwsze przestawienie na tablicy nadaje ranki wszystkim jej zgłoszeniom naraz,
        // w kolejności, w jakiej użytkownik je właśnie widział. Bez tego sąsiedzi upuszczonej
        // karty bywają bez ranku i nie ma między czym szukać środka.
        var cards = await _cards.MaterializeBoardAsync(board.Uuid, _clock.UtcNow, ct).ConfigureAwait(false);

        var card = cards.FirstOrDefault(c => c.IssueUuid == command.IssueUuid)
            ?? throw new AggregateNotFoundException(nameof(BoardCard), command.IssueUuid);

        var previousRank = RankOf(cards, command.AfterIssueUuid, card);
        var nextRank = RankOf(cards, command.BeforeIssueUuid, card);

        card.SetPosition(previousRank, nextRank, _clock.UtcNow);

        return board.Uuid;
    }

    /// <summary>Rank sąsiada. Wskazanie samej przestawianej karty jako sąsiada traktujemy jak
    /// brak sąsiada — front bywa o pół ruchu do tyłu, a ta sytuacja nie jest błędem
    /// użytkownika.</summary>
    private static string? RankOf(IReadOnlyList<BoardCard> cards, Guid? issueUuid, BoardCard moved)
    {
        if (issueUuid is not { } uuid || uuid == moved.IssueUuid)
        {
            return null;
        }

        return cards.FirstOrDefault(c => c.IssueUuid == uuid)?.Rank;
    }
}

/// <summary>
/// Przenosi kartę między backlogiem (<see cref="SprintUuid"/> puste) a sprintem — i przestawia
/// ją w docelowej liście, w jednym ruchu (SPR-002).
///
/// <para>Backlog i sprint dzielą <b>ten sam mechanizm ranku</b>, co kolumny tablicy
/// (<c>docs/backend/task-management.md</c> §7.2, SPR-002 AC1): to wciąż jeden <c>board_card.rank</c>
/// na kartę, a front filtruje widok po przynależności do sprintu. Sąsiedzi w komendzie są więc
/// zawsze z listy, do której karta właśnie trafia — tak samo jak przy przeciąganiu na tablicy
/// kanbanowej.</para>
/// </summary>
public sealed class BoardSetCardSprintCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid tablicy.</summary>
    public Guid Uuid { get; set; }

    public Guid IssueUuid { get; set; }

    /// <summary>Puste = karta wraca do backlogu.</summary>
    public Guid? SprintUuid { get; set; }

    public Guid? AfterIssueUuid { get; set; }

    public Guid? BeforeIssueUuid { get; set; }
}

public sealed class BoardSetCardSprintCommandHandler : CommandHandler<BoardSetCardSprintCommand, Guid>
{
    private readonly IBoardRepository _boards;
    private readonly IBoardCardRepository _cards;
    private readonly IIssueRepository _issues;
    private readonly ISprintRepository _sprints;
    private readonly IClock _clock;

    public BoardSetCardSprintCommandHandler(
        IBoardRepository boards,
        IBoardCardRepository cards,
        IIssueRepository issues,
        ISprintRepository sprints,
        IClock clock)
    {
        _boards = boards;
        _cards = cards;
        _issues = issues;
        _sprints = sprints;
        _clock = clock;
    }

    public override async Task<Guid> ExecuteAsync(BoardSetCardSprintCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var board = await _boards.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Board), command.Uuid);

        var issue = await _issues.FindAsync(command.IssueUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Domain.Issues.Issue), command.IssueUuid);

        if (issue.ProjectUuid != board.ProjectUuid)
        {
            throw new DomainException(
                "taskmgmt.board_card_other_project",
                "Zgłoszenie nie należy do projektu tej tablicy — ktoś przeniósł je w międzyczasie.");
        }

        if (command.SprintUuid is { } sprintUuid)
        {
            var sprint = await _sprints.FindAsync(sprintUuid, ct).ConfigureAwait(false)
                ?? throw new AggregateNotFoundException(nameof(Domain.Sprints.Sprint), sprintUuid);

            if (sprint.BoardUuid != board.Uuid)
            {
                throw new DomainException(
                    "taskmgmt.sprint_other_board",
                    "Sprint nie należy do tej tablicy.");
            }

            if (sprint.Status == Domain.Sprints.SprintStatus.Closed)
            {
                throw new DomainException(
                    "taskmgmt.sprint_closed",
                    "Zamknięty sprint jest tylko do odczytu — jego skład jest zamrożony na potrzeby raportu.");
            }
        }

        var cards = await _cards.MaterializeBoardAsync(board.Uuid, _clock.UtcNow, ct).ConfigureAwait(false);

        var card = cards.FirstOrDefault(c => c.IssueUuid == command.IssueUuid)
            ?? throw new AggregateNotFoundException(nameof(BoardCard), command.IssueUuid);

        card.SetSprint(command.SprintUuid, _clock.UtcNow);

        var previousRank = RankOf(cards, command.AfterIssueUuid, card);
        var nextRank = RankOf(cards, command.BeforeIssueUuid, card);

        card.SetPosition(previousRank, nextRank, _clock.UtcNow);

        return board.Uuid;
    }

    private static string? RankOf(IReadOnlyList<BoardCard> cards, Guid? issueUuid, BoardCard moved)
    {
        if (issueUuid is not { } uuid || uuid == moved.IssueUuid)
        {
            return null;
        }

        return cards.FirstOrDefault(c => c.IssueUuid == uuid)?.Rank;
    }
}
