using Erp.BuildingBlocks.Domain;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Boards;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium tablic — razem z kolumnami, bo to jeden agregat.</summary>
public sealed class BoardRepository : IBoardRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public BoardRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<Board?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.Boards
            .Include(b => b.Columns)
            .FirstOrDefaultAsync(b => b.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(Board board) => _dbContext.Boards.Add(board);
}

/// <summary>Karty tablicy — patrz <see cref="IBoardCardRepository"/> co do niesymetrycznego
/// kształtu tego interfejsu.</summary>
public sealed class BoardCardRepository : IBoardCardRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public BoardCardRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<IReadOnlyList<BoardCard>> MaterializeBoardAsync(
        Guid boardUuid,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var projectUuid = await _dbContext.Boards
            .AsNoTracking()
            .Where(b => b.Uuid == boardUuid)
            .Select(b => b.ProjectUuid)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (projectUuid == Guid.Empty)
        {
            throw new AggregateNotFoundException(nameof(Board), boardUuid);
        }

        var cards = await _dbContext.BoardCards
            .Where(c => c.BoardUuid == boardUuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // Zgłoszenia bez karty — widoczność świadomie NIE jest tu liczona. To zapis, a nie
        // odczyt: pominięcie zgłoszenia prywatnego zostawiłoby dziurę w numeracji tablicy
        // zależną od tego, KTO akurat przeciągnął pierwszą kartę, a kolejność tablicy jest
        // wspólna dla wszystkich, którzy ją widzą.
        var ranked = cards.Select(c => c.IssueUuid).ToHashSet();

        var missing = await _dbContext.Issues
            .AsNoTracking()
            .Where(i => i.ProjectUuid == projectUuid && !ranked.Contains(i.Uuid))
            .OrderBy(i => i.CreatedAt)
            .ThenBy(i => i.Uuid)
            .Select(i => i.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        cards.Sort(CompareByPosition);

        if (missing.Count == 0)
        {
            return cards;
        }

        // Nowe zgłoszenia lądują na końcu, a cała tablica dostaje równomiernie rozłożone ranki.
        // Nadanie ranków wyłącznie brakującym — po jednym, każdy za poprzednim — dawałoby
        // łańcuch rosnący z każdą kartą, czyli tablicę do rebalansu w dniu założenia (§7.2).
        var order = cards.Select(c => c.IssueUuid).Concat(missing).ToList();
        var ranks = BoardRank.Sequence(order.Count);

        var byIssue = cards.ToDictionary(c => c.IssueUuid);
        var materialized = new List<BoardCard>(order.Count);

        for (var i = 0; i < order.Count; i++)
        {
            if (byIssue.TryGetValue(order[i], out var existing))
            {
                existing.Rebalance(ranks[i], now);
                materialized.Add(existing);
                continue;
            }

            var card = BoardCard.CreateWithUuid(Entity.NewUuid(), boardUuid, order[i], ranks[i], now);
            _dbContext.BoardCards.Add(card);
            materialized.Add(card);
        }

        return materialized;
    }

    /// <summary>Porządek kart: rank, a przy identycznym ranku — uuid. Para <c>(rank, uuid)</c>
    /// jest tu rozstrzygająca celowo: dwie osoby wstawiające kartę w to samo miejsce wyliczą
    /// ten sam rank i obie muszą zobaczyć tę samą kolejność (§7.3).</summary>
    private static int CompareByPosition(BoardCard left, BoardCard right)
    {
        var byRank = string.CompareOrdinal(left.Rank, right.Rank);

        return byRank != 0 ? byRank : left.Uuid.CompareTo(right.Uuid);
    }
}
