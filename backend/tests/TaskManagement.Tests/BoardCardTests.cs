using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.Boards;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Reguły tablicy i karty — agregat, bo to on je egzekwuje niezależnie od tego,
/// którym endpointem przyszło żądanie.</summary>
public class BoardCardTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid IssueUuid = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid TodoState = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid DoneState = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly DateTimeOffset Now = new(2026, 8, 27, 12, 0, 0, TimeSpan.Zero);

    private static Board Board()
        => Domain.Boards.Board.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "Tablica DEV", BoardMode.Kanban, isDefault: true);

    private static BoardCard Card(string rank = "n")
        => BoardCard.CreateWithUuid(Guid.CreateVersion7(), Guid.CreateVersion7(), IssueUuid, rank, Now);

    /// <summary>
    /// Dwie osoby wstawiające kartę w to samo miejsce wyliczą identyczny rank — i to
    /// <b>nie jest błąd</b> (§7.3). Porządek rozstrzyga para <c>(rank, uuid)</c>, więc obie
    /// zobaczą tę samą kolejność; odrzucenie takiej operacji błędem współbieżności byłoby
    /// wrogie, bo obie zrobiły coś sensownego.
    /// </summary>
    [Fact]
    public void Dwie_karty_wstawione_w_to_samo_miejsce_dostaja_ten_sam_rank()
    {
        var first = Card("z");
        var second = Card("z");

        first.SetPosition("n", "o", Now);
        second.SetPosition("n", "o", Now);

        first.Rank.ShouldBe(second.Rank);
    }

    [Fact]
    public void Przestawienie_w_to_samo_miejsce_nie_dotyka_karty()
    {
        var card = Card();
        var rank = BoardRank.Between("n", "o");
        card.SetPosition("n", "o", Now);

        card.SetPosition("n", "o", Now.AddHours(1));

        card.Rank.ShouldBe(rank);
        card.UpdatedAt.ShouldBe(Now);
    }

    [Fact]
    public void Stan_zmapowany_na_dwie_kolumny_jest_odrzucany()
    {
        var board = Board();
        board.AddColumn(Guid.CreateVersion7(), "Do zrobienia", 0, [TodoState]);

        Should.Throw<DomainException>(() => board.AddColumn(Guid.CreateVersion7(), "Zrobione", 1, [TodoState, DoneState]))
            .ErrorCode.ShouldBe("taskmgmt.board_column_state_taken");
    }

    [Fact]
    public void Kolumna_bez_stanu_jest_odrzucana()
        => Should.Throw<DomainException>(() => Board().AddColumn(Guid.CreateVersion7(), "Pusta", 0, []))
            .ErrorCode.ShouldBe("taskmgmt.board_column_without_state");

    /// <summary>Stan nieprzypisany do żadnej kolumny jest dozwolony i znaczy „zgłoszenie znika
    /// z tablicy” — tak działa kolumna „gotowe” schowana za filtrem.</summary>
    [Fact]
    public void Stan_bez_kolumny_nie_ma_kolumny_i_nie_jest_bledem()
    {
        var board = Board();
        board.AddColumn(Guid.CreateVersion7(), "Do zrobienia", 0, [TodoState]);

        board.ColumnForState(DoneState).ShouldBeNull();
        board.ColumnForState(TodoState).ShouldNotBeNull();
    }
}
