using Shouldly;
using TaskManagement.Domain.Boards;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Swimlane'y (BRD-006) i limity WIP (BRD-007) na tablicy.</summary>
public class BoardSwimlaneAndWipTests
{
    private static Board NewBoard()
        => Board.CreateWithUuid(Guid.CreateVersion7(), Guid.CreateVersion7(), "Tablica", BoardMode.Kanban, true);

    [Fact]
    public void Tablica_domyslnie_nie_ma_swimlaneow()
    {
        var board = NewBoard();

        board.SwimlaneMode.ShouldBe(BoardSwimlaneMode.None);
        board.SwimlaneFieldCode.ShouldBeNull();
    }

    [Fact]
    public void Grupowanie_po_przypisanym_nie_wymaga_kodu_pola()
    {
        var board = NewBoard();

        board.SetSwimlane(BoardSwimlaneMode.Assignee, null);

        board.SwimlaneMode.ShouldBe(BoardSwimlaneMode.Assignee);
        board.SwimlaneFieldCode.ShouldBeNull();
    }

    [Fact]
    public void Grupowanie_po_polu_niestandardowym_wymaga_kodu()
    {
        var board = NewBoard();

        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(
            () => board.SetSwimlane(BoardSwimlaneMode.CustomField, null));
    }

    [Fact]
    public void Kod_pola_poza_trybem_niestandardowym_jest_odrzucany()
    {
        var board = NewBoard();

        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(
            () => board.SetSwimlane(BoardSwimlaneMode.Priority, "kanal"));
    }

    [Fact]
    public void Grupowanie_po_polu_niestandardowym_zapisuje_kod()
    {
        var board = NewBoard();

        board.SetSwimlane(BoardSwimlaneMode.CustomField, "kanal");

        board.SwimlaneFieldCode.ShouldBe("kanal");
    }

    [Fact]
    public void Kolumna_bez_limitu_wip_ma_null()
    {
        var board = NewBoard();

        var column = board.AddColumn(Guid.CreateVersion7(), "Todo", 0, [Guid.CreateVersion7()]);

        column.WipLimit.ShouldBeNull();
    }

    [Fact]
    public void Kolumna_z_limitem_wip_go_zapisuje()
    {
        var board = NewBoard();

        var column = board.AddColumn(Guid.CreateVersion7(), "W toku", 0, [Guid.CreateVersion7()], wipLimit: 3);

        column.WipLimit.ShouldBe(3);
    }

    [Fact]
    public void Nieodatni_limit_wip_jest_odrzucany()
    {
        var board = NewBoard();

        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(
            () => board.AddColumn(Guid.CreateVersion7(), "W toku", 0, [Guid.CreateVersion7()], wipLimit: 0));
    }
}
