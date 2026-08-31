using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.Sprints;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Reguły fazy 6. Sprint jest jedynym agregatem w module z <b>cyklem życia</b>
/// (zaplanowany → aktywny → zamknięty), więc testowana jest sama sekwencja: to na niej stoi
/// „zamknij sprint i przenieś niedokończone", które bez aktywnego sprintu nie ma czego przenieść.
/// </summary>
public sealed class SprintTests
{
    private static readonly Guid BoardUuid = Guid.Parse("33333333-3333-3333-3333-333333333333");

    private static Sprint Planned() => Sprint.CreateWithUuid(
        Guid.CreateVersion7(), BoardUuid, "Sprint 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 14));

    [Fact]
    public void Nowy_sprint_jest_zaplanowany()
    {
        Planned().Status.ShouldBe(SprintStatus.Planned);
    }

    [Fact]
    public void Koniec_przed_poczatkiem_jest_odrzucany()
    {
        var act = () => Sprint.CreateWithUuid(
            Guid.CreateVersion7(), BoardUuid, "Sprint 1", new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 1));

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.sprint_date_range_invalid");
    }

    [Fact]
    public void Sprint_bez_tablicy_nie_istnieje()
    {
        var act = () => Sprint.CreateWithUuid(
            Guid.CreateVersion7(), Guid.Empty, "Sprint 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 14));

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.sprint_board_empty");
    }

    [Fact]
    public void Uruchomienie_zmienia_stan_na_aktywny()
    {
        var sprint = Planned();

        sprint.Start();

        sprint.Status.ShouldBe(SprintStatus.Active);
    }

    [Fact]
    public void Drugie_uruchomienie_jest_odrzucane()
    {
        var sprint = Planned();
        sprint.Start();

        var act = sprint.Start;

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.sprint_not_planned");
    }

    [Fact]
    public void Zamkniecie_zaplanowanego_sprintu_jest_odrzucane()
    {
        // Zamknięcie sprintu przenosi niedokończone zgłoszenia — na sprincie, który nigdy nie
        // ruszył, ta operacja nie ma znaczenia i byłaby cichym sposobem na jego skasowanie.
        var act = Planned().Close;

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.sprint_not_active");
    }

    [Fact]
    public void Zamkniety_sprint_nie_wraca_do_gry()
    {
        var sprint = Planned();
        sprint.Start();
        sprint.Close();

        var start = sprint.Start;
        var close = sprint.Close;

        sprint.Status.ShouldBe(SprintStatus.Closed);
        start.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.sprint_not_planned");
        close.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.sprint_not_active");
    }
}
