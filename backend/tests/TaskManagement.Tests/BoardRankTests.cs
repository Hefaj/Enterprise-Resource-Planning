using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.Boards;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Indeksowanie ułamkowe kolejności kart (<c>docs/backend/task-management.md</c> §7.2).
///
/// <para>To jest ta część fazy 2, w której pomyłka nie objawia się wyjątkiem, tylko kartą
/// wracającą po odświeżeniu na inne miejsce niż ta, w które ją upuszczono. Stąd testy na
/// niezmiennikach, a nie na konkretnych łańcuchach: wartość ranku jest szczegółem, jego
/// uporządkowanie — kontraktem.</para>
/// </summary>
public class BoardRankTests
{
    [Fact]
    public void Rank_miedzy_sasiadami_lezy_miedzy_nimi()
    {
        var rank = BoardRank.Between("n", "o");

        string.CompareOrdinal("n", rank).ShouldBeLessThan(0);
        string.CompareOrdinal(rank, "o").ShouldBeLessThan(0);
    }

    [Fact]
    public void Rank_na_poczatku_listy_jest_mniejszy_od_pierwszej_karty()
        => string.CompareOrdinal(BoardRank.Between(null, "n"), "n").ShouldBeLessThan(0);

    [Fact]
    public void Rank_na_koncu_listy_jest_wiekszy_od_ostatniej_karty()
        => string.CompareOrdinal("n", BoardRank.Between("n", null)).ShouldBeLessThan(0);

    [Fact]
    public void Pusta_tablica_dostaje_rank_ze_srodka_alfabetu()
    {
        var rank = BoardRank.Between(null, null);

        string.CompareOrdinal("0", rank).ShouldBeLessThan(0);
        string.CompareOrdinal(rank, "z").ShouldBeLessThan(0);
    }

    /// <summary>
    /// Jedyny przypadek, w którym ten schemat przestaje działać: rank kończący się najmniejszym
    /// znakiem alfabetu (między <c>"0"</c> a <c>"00"</c> nie da się nic wstawić). Niezmiennik
    /// pilnuje, żeby taki rank nigdy nie powstał.
    /// </summary>
    [Fact]
    public void Zaden_wygenerowany_rank_nie_konczy_sie_najmniejszym_znakiem()
    {
        var rank = BoardRank.Between(null, null);

        for (var i = 0; i < 200; i++)
        {
            rank.ShouldNotEndWith("0");
            rank = BoardRank.Between(null, rank);
        }

        BoardRank.Sequence(50).ShouldAllBe(r => !r.EndsWith('0'));
    }

    /// <summary>Wielokrotne wstawianie w to samo miejsce — jedyny scenariusz, w którym łańcuchy
    /// rosną. Kolejność musi być zachowana przez cały czas; długość jest tym, na co patrzy
    /// rebalans.</summary>
    [Fact]
    public void Wielokrotne_wstawienie_w_to_samo_miejsce_zachowuje_porzadek()
    {
        var lower = BoardRank.Between(null, null);
        var upper = BoardRank.Between(lower, null);

        for (var i = 0; i < 100; i++)
        {
            var inserted = BoardRank.Between(lower, upper);

            string.CompareOrdinal(lower, inserted).ShouldBeLessThan(0);
            string.CompareOrdinal(inserted, upper).ShouldBeLessThan(0);

            upper = inserted;
        }

        BoardRank.NeedsRebalance(upper.Length).ShouldBeTrue();
    }

    [Fact]
    public void Sasiedzi_w_zlej_kolejnosci_sa_odrzucani()
        => Should.Throw<DomainException>(() => BoardRank.Between("o", "n"))
            .ErrorCode.ShouldBe("taskmgmt.board_rank_invalid_bounds");

    [Fact]
    public void Identyczni_sasiedzi_sa_odrzucani()
        => Should.Throw<DomainException>(() => BoardRank.Between("n", "n"))
            .ErrorCode.ShouldBe("taskmgmt.board_rank_invalid_bounds");

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(50)]
    [InlineData(500)]
    public void Sekwencja_jest_rosnaca_i_ma_zadana_dlugosc(int count)
    {
        var ranks = BoardRank.Sequence(count);

        ranks.Count.ShouldBe(count);
        ranks.ShouldBeUnique();

        for (var i = 1; i < ranks.Count; i++)
        {
            string.CompareOrdinal(ranks[i - 1], ranks[i]).ShouldBeLessThan(0);
        }
    }

    /// <summary>Sekwencja rozkłada karty równomiernie właśnie po to, żeby dało się między nie
    /// wstawiać dalej — po rebalansie użytkownik nie przestaje przestawiać kart.</summary>
    [Fact]
    public void Po_sekwencji_da_sie_wstawic_miedzy_sasiadow()
    {
        var ranks = BoardRank.Sequence(10);

        for (var i = 1; i < ranks.Count; i++)
        {
            var inserted = BoardRank.Between(ranks[i - 1], ranks[i]);

            string.CompareOrdinal(ranks[i - 1], inserted).ShouldBeLessThan(0);
            string.CompareOrdinal(inserted, ranks[i]).ShouldBeLessThan(0);
        }
    }
}
