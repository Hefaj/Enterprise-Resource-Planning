using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Boards;
using TaskManagement.Application.FieldSchemes;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>
/// Odczyty tablic — <c>AsNoTracking</c> i projekcja wprost do DTO, z pominięciem repozytoriów
/// (<c>docs/guides/backend/cqrs.md</c>).
///
/// <para>Widoczność tablicy dziedziczy po projekcie, a widoczność karty po zgłoszeniu: ten sam
/// predykat, co na liście zgłoszeń, więc zgłoszenie prywatne nie wypływa bocznymi drzwiami
/// przez tablicę.</para>
/// </summary>
public sealed class BoardQueries : IBoardQueries
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;
    private readonly IFieldSchemeQueries _fields;

    public BoardQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext, IFieldSchemeQueries fields)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
        _fields = fields;
    }

    /// <inheritdoc />
    public async Task<List<BoardDto>> SearchAsync(SearchBoardRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = Visible();

        if (request.ProjectUuid is { } projectUuid)
        {
            query = query.Where(b => b.ProjectUuid == projectUuid);
        }

        return await Project(query.OrderBy(b => b.Name))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public Task<BoardDto?> GetAsync(Guid uuid, CancellationToken cancellationToken)
        => Project(Visible().Where(b => b.Uuid == uuid)).FirstOrDefaultAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<List<BoardCardDto>> GetCardsAsync(
        GetBoardCardsRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var userUuid = IssueVisibility.CurrentUser(_executionContext);

        var board = await Visible()
            .Where(b => b.Uuid == request.BoardUuid)
            .Select(b => new { b.Uuid, b.ProjectUuid, b.SwimlaneMode, b.SwimlaneFieldCode })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (board is null)
        {
            return [];
        }

        // Slot pola niestandardowego wskazanego przez swimlane — rozwiązywany raz na żądanie,
        // nie per karta (§6, ten sam mechanizm co przy filtrach listy zgłoszeń).
        FieldSlot? swimlaneSlot = null;
        if (board.SwimlaneMode == BoardSwimlaneMode.CustomField && board.SwimlaneFieldCode is { } fieldCode)
        {
            var slots = await _fields.GetProjectSlotMapAsync(board.ProjectUuid, cancellationToken).ConfigureAwait(false);
            slots.TryGetValue(fieldCode, out var slot);
            swimlaneSlot = slot;
        }

        // Lewe złączenie zgłoszeń z kartami: zgłoszenie, którego nikt jeszcze nie przestawiał,
        // nie ma wiersza w `board_card` i wraca z pustym rankiem, na końcu tablicy. Wiersz
        // powstaje dopiero przy pierwszym przeciągnięciu (IBoardCardRepository).
        var query =
            from issue in _dbContext.Issues.AsNoTracking().VisibleTo(_dbContext, userUuid)
            where issue.ProjectUuid == board.ProjectUuid
            join type in _dbContext.IssueTypes.AsNoTracking() on issue.TypeUuid equals type.Uuid
            join card in _dbContext.BoardCards.AsNoTracking().Where(c => c.BoardUuid == board.Uuid)
                on issue.Uuid equals card.IssueUuid into cards
            from card in cards.DefaultIfEmpty()
            join parent in _dbContext.Issues.AsNoTracking()
                on issue.ParentUuid equals parent.Uuid into parents
            from parent in parents.DefaultIfEmpty()
            select new BoardCardDto(
                card != null ? card.Uuid : issue.Uuid,
                board.Uuid,
                issue.Uuid,
                card != null ? card.Rank : null,
                card != null ? card.SprintUuid : null,
                issue.Key,
                issue.Title,
                issue.TypeUuid,
                type.Name,
                type.Category,
                type.Icon,
                issue.StateUuid,
                issue.Priority,
                issue.AssigneeUuid,
                issue.DueAt,
                issue.CreatedAt,
                issue.ParentUuid,
                parent != null ? parent.Title : null,
                // Tylko sloty tekstowe: pole niestandardowe typu Select (odpowiednik „Enum")
                // dzieli pulę ze zwykłym tekstem (§6, FieldSlots.Accepts).
                swimlaneSlot == FieldSlot.Text1 ? issue.Text1
                    : swimlaneSlot == FieldSlot.Text2 ? issue.Text2
                    : swimlaneSlot == FieldSlot.Text3 ? issue.Text3
                    : swimlaneSlot == FieldSlot.Text4 ? issue.Text4
                    : null);

        if (request.Uuids is { Count: > 0 })
        {
            // Odświeżenie po zdarzeniu realtime idzie po uuid KARTY — przeciągnięcie jednej
            // karty nie może kazać klientowi pobierać całej tablicy (§7.4).
            var uuids = request.Uuids;
            query = query.Where(c => uuids.Contains(c.Uuid));
        }

        var result = await query.ToListAsync(cancellationToken).ConfigureAwait(false);

        // Porządek rozstrzyga para (rank, uuid), nigdy sam rank: dwie osoby wstawiające kartę
        // w to samo miejsce wyliczą identyczny rank i obie muszą zobaczyć tę samą kolejność
        // (§7.3). Sortowanie w pamięci, bo lista tablicy to setki kart, nie strona z bazy.
        result.Sort(static (left, right) =>
        {
            if (left.Rank is null || right.Rank is null)
            {
                return left.Rank is null && right.Rank is null
                    ? Compare(left, right)
                    : left.Rank is null ? 1 : -1;
            }

            var byRank = string.CompareOrdinal(left.Rank, right.Rank);

            return byRank != 0 ? byRank : left.Uuid.CompareTo(right.Uuid);
        });

        return result;
    }

    /// <summary>Kolejność zgłoszeń bez ranku — po dacie utworzenia, jak na liście zgłoszeń.
    /// To ta sama kolejność, w której zobaczy je materializacja tablicy, więc pierwsze
    /// przeciągnięcie niczym nie przestawia widoku pod użytkownikiem.</summary>
    private static int Compare(BoardCardDto left, BoardCardDto right)
    {
        var byCreatedAt = left.CreatedAt.CompareTo(right.CreatedAt);

        return byCreatedAt != 0 ? byCreatedAt : left.IssueUuid.CompareTo(right.IssueUuid);
    }

    private IQueryable<Board> Visible()
    {
        var userUuid = IssueVisibility.CurrentUser(_executionContext);

        return _dbContext.Boards
            .AsNoTracking()
            .Where(b => _dbContext.Projects.VisibleTo(_dbContext, userUuid).Any(p => p.Uuid == b.ProjectUuid));
    }

    private static IQueryable<BoardDto> Project(IQueryable<Board> boards)
        => boards.Select(b => new BoardDto(
            b.Uuid,
            b.ProjectUuid,
            b.Name,
            b.Mode,
            b.IsDefault,
            b.Columns
                .OrderBy(c => c.OrderNo)
                // Stany kolumny czytane przez pole zapasowe: `StateUuids` jest projekcją
                // tylko do odczytu (`AsReadOnly`), której EF nie umie przetłumaczyć na SQL.
                .Select(c => new BoardColumnDto(
                    c.Uuid,
                    c.Name,
                    c.OrderNo,
                    EF.Property<List<Guid>>(c, "_stateUuids"),
                    c.WipLimit))
                .ToList(),
            b.SwimlaneMode,
            b.SwimlaneFieldCode));
}
