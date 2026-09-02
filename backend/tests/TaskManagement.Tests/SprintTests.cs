using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.Sprints;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Reguły sprintu — agregat, bo to on je egzekwuje niezależnie od tego, którym
/// endpointem przyszło żądanie (SPR-001..003).</summary>
public class SprintTests
{
    private static readonly Guid BoardUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly DateTimeOffset Now = new(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);

    private static Sprint Create(DateOnly? starts = null, DateOnly? ends = null)
        => Sprint.CreateWithUuid(Guid.CreateVersion7(), BoardUuid, "Sprint 12", "Domknąć backlog fazy 6", starts, ends);

    [Fact]
    public void Zakladanie_sprintu_bez_tablicy_jest_odrzucane()
        => Should.Throw<DomainException>(() => Sprint.CreateWithUuid(Guid.CreateVersion7(), Guid.Empty, "Sprint 1", null, null, null))
            .ErrorCode.ShouldBe("taskmgmt.sprint_board_empty");

    [Fact]
    public void Data_zakonczenia_wczesniejsza_niz_rozpoczecia_jest_odrzucana()
        => Should.Throw<DomainException>(() => Create(
                starts: new DateOnly(2026, 9, 10),
                ends: new DateOnly(2026, 9, 1)))
            .ErrorCode.ShouldBe("taskmgmt.sprint_dates_invalid");

    [Fact]
    public void Nowy_sprint_jest_planowany()
        => Create().Status.ShouldBe(SprintStatus.Planned);

    [Fact]
    public void Aktywacja_planowanego_sprintu_ustawia_status_i_znacznik_czasu()
    {
        var sprint = Create();

        sprint.Start(Now);

        sprint.Status.ShouldBe(SprintStatus.Active);
        sprint.ActivatedAt.ShouldBe(Now);
    }

    [Fact]
    public void Ponowna_aktywacja_aktywnego_sprintu_jest_bez_skutku()
    {
        var sprint = Create();
        sprint.Start(Now);

        sprint.Start(Now.AddHours(1));

        sprint.ActivatedAt.ShouldBe(Now);
    }

    [Fact]
    public void Aktywacja_zamknietego_sprintu_jest_odrzucana()
    {
        var sprint = Create();
        sprint.Start(Now);
        sprint.Close(Now.AddDays(14));

        Should.Throw<DomainException>(() => sprint.Start(Now.AddDays(15)))
            .ErrorCode.ShouldBe("taskmgmt.sprint_not_plannable");
    }

    [Fact]
    public void Zamkniecie_sprintu_ktory_nigdy_nie_byl_aktywny_jest_odrzucane()
        => Should.Throw<DomainException>(() => Create().Close(Now))
            .ErrorCode.ShouldBe("taskmgmt.sprint_not_active");

    [Fact]
    public void Zamkniecie_aktywnego_sprintu_ustawia_status_i_znacznik_czasu()
    {
        var sprint = Create();
        sprint.Start(Now);

        sprint.Close(Now.AddDays(14));

        sprint.Status.ShouldBe(SprintStatus.Closed);
        sprint.ClosedAt.ShouldBe(Now.AddDays(14));
    }

    [Fact]
    public void Ponowne_zamkniecie_zamknietego_sprintu_jest_bez_skutku()
    {
        var sprint = Create();
        sprint.Start(Now);
        sprint.Close(Now.AddDays(14));

        sprint.Close(Now.AddDays(20));

        sprint.ClosedAt.ShouldBe(Now.AddDays(14));
    }

    /// <summary>SPR-003 AC2: zamknięty sprint jest tylko do odczytu — skład zamraża się na
    /// potrzeby raportu, więc dalsza zmiana planu jest odrzucana, a nie cicho ignorowana.</summary>
    [Fact]
    public void Zmiana_dat_zamknietego_sprintu_jest_odrzucana()
    {
        var sprint = Create();
        sprint.Start(Now);
        sprint.Close(Now.AddDays(14));

        Should.Throw<DomainException>(() => sprint.SetDates(new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 14), null))
            .ErrorCode.ShouldBe("taskmgmt.sprint_closed");
    }

    [Fact]
    public void Pusty_cel_jest_normalizowany_do_null()
    {
        var sprint = Create();

        sprint.SetDates(null, null, "   ");

        sprint.Goal.ShouldBeNull();
    }
}
