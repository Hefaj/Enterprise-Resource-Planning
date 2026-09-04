using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TaskManagement.Domain.Boards;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Jobs;

/// <summary>
/// Przenumerowuje tablicę, gdy najdłuższy rank przekroczy próg
/// (<c>docs/modules/task-management/domain.md</c> §7.2).
///
/// <para>Łańcuchy rosną wyłącznie przy wielokrotnym wstawianiu <b>w to samo miejsce</b>:
/// między <c>"n"</c> a <c>"o"</c> wchodzi <c>"nn"</c>, potem <c>"nnn"</c> i tak dalej. Sama
/// praca na tablicy tego nie robi — porządkowanie backlogu przez pół godziny już tak.</para>
///
/// <para><b>Rebalans jest głośny i to jest jego cena.</b> Przepisuje ranki wszystkich kart
/// tablicy, więc idzie <c>BulkChanged</c> (unieważnienie sygnatury), a nie kilkaset uuid-ów
/// przez WebSocket — dokładnie przed tym chroni próg koalescencji w Notification (§7.4).
/// Dlatego próg długości jest wysoki: rebalans ma być rzadkim zdarzeniem.</para>
/// </summary>
[ClusterSafe("Dzierżawa taskmgmt:board-rank-rebalance na advisory locku Postgresa — dwie instancje "
    + "przepisujące ranki tej samej tablicy naraz dałyby dwa różne porządki, a wygrałby ten, "
    + "który zapisał drugi.")]
public sealed partial class BoardRankRebalanceService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BoardRankRebalanceService> _logger;

    public BoardRankRebalanceService(
        IServiceScopeFactory scopeFactory,
        ILogger<BoardRankRebalanceService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        do
        {
            try
            {
                await RebalanceOnceAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogRebalanceFailed(_logger, ex);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    private async Task RebalanceOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();

        var lease = scope.ServiceProvider.GetRequiredService<IExclusiveLease>();
        await using var held = await lease
            .TryAcquireAsync("taskmgmt:board-rank-rebalance", ct)
            .ConfigureAwait(false);

        if (held is null)
        {
            return;
        }

        var dbContext = scope.ServiceProvider.GetRequiredService<TaskManagementDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IClock>();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        // Tablice do przenumerowania wybieramy jednym zapytaniem po długości ranku — bez
        // ładowania kart tablic, których problem nie dotyczy.
        var boardUuids = await dbContext.BoardCards
            .AsNoTracking()
            .GroupBy(c => c.BoardUuid)
            .Where(g => g.Max(c => c.Rank.Length) > BoardRank.RebalanceLengthThreshold)
            .Select(g => g.Key)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (boardUuids.Count == 0)
        {
            return;
        }

        var now = clock.UtcNow;

        foreach (var boardUuid in boardUuids)
        {
            var cards = await dbContext.BoardCards
                .Where(c => c.BoardUuid == boardUuid)
                .ToListAsync(ct)
                .ConfigureAwait(false);

            // Kolejność sprzed rebalansu jest jedyną rzeczą, której nie wolno tu zgubić —
            // użytkownik ustawiał ją ręcznie i po przenumerowaniu ma zobaczyć to samo.
            cards.Sort(static (left, right) =>
            {
                var byRank = string.CompareOrdinal(left.Rank, right.Rank);

                return byRank != 0 ? byRank : left.Uuid.CompareTo(right.Uuid);
            });

            var ranks = BoardRank.Sequence(cards.Count);

            for (var i = 0; i < cards.Count; i++)
            {
                cards[i].Rebalance(ranks[i], now);
            }

            // Zapis per tablica, nie jeden na wszystkie: konflikt współbieżności z kimś, kto
            // właśnie przeciąga kartę, ma wywrócić jedną tablicę, a nie cały przebieg.
            await unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

            LogBoardRebalanced(_logger, boardUuid, cards.Count);
        }
    }

    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Information,
        Message = "Rebalans tablicy {BoardUuid}: przenumerowano {CardCount} kart.")]
    private static partial void LogBoardRebalanced(ILogger logger, Guid boardUuid, int cardCount);

    [LoggerMessage(
        EventId = 2,
        Level = LogLevel.Error,
        Message = "Rebalans rangi kart nie powiódł się w tym cyklu — spróbuję ponownie za 15 minut.")]
    private static partial void LogRebalanceFailed(ILogger logger, Exception ex);
}
