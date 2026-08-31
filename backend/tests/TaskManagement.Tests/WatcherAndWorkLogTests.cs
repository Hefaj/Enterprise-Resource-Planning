using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Obserwatorzy zgłoszenia, wzmianki w komentarzach, praca zalogowana i osobiste widoki listy —
/// czyli to, z czego liczą się odbiorcy powiadomień i zakres „Obserwowane" na liście.
/// </summary>
public sealed class WatcherAndWorkLogTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("66666666-6666-6666-6666-666666666666");
    private static readonly Guid ReporterUuid = Guid.Parse("77777777-7777-7777-7777-777777777777");
    private static readonly Guid WatcherUuid = Guid.Parse("88888888-8888-8888-8888-888888888888");
    private static readonly DateTimeOffset Now = new(2026, 9, 1, 10, 0, 0, TimeSpan.Zero);

    private static Issue NewIssue() => Issue.CreateWithUuid(
        Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", WorkflowSchemeDefaults.Build(), ReporterUuid, Now);

    [Fact]
    public void Nowe_zgloszenie_nie_ma_obserwatorow()
    {
        NewIssue().Watchers.ShouldBeEmpty();
    }

    [Fact]
    public void Dodanie_obserwatora_jest_idempotentne()
    {
        var issue = NewIssue();

        issue.AddWatcher(WatcherUuid, Now);
        issue.AddWatcher(WatcherUuid, Now);

        issue.Watchers.ShouldBe([WatcherUuid]);
    }

    [Fact]
    public void Obserwator_musi_wskazywac_uzytkownika()
    {
        var issue = NewIssue();

        var act = () => issue.AddWatcher(Guid.Empty, Now);

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.issue_watcher_empty");
    }

    [Fact]
    public void Zdjecie_nieistniejacej_obserwacji_nie_jest_bledem()
    {
        var issue = NewIssue();

        issue.RemoveWatcher(WatcherUuid, Now);

        issue.Watchers.ShouldBeEmpty();
    }

    [Fact]
    public void Zdjecie_obserwacji_usuwa_z_listy()
    {
        var issue = NewIssue();
        issue.AddWatcher(WatcherUuid, Now);

        issue.RemoveWatcher(WatcherUuid, Now);

        issue.Watchers.ShouldBeEmpty();
    }

    [Fact]
    public void Wzmianki_czytamy_z_tresci_komentarza()
    {
        var body = $"""<p>Popatrz na to <span data-mention-uuid="{WatcherUuid}">@Jan Kowalski</span></p>""";

        IssueMentions.Extract(body).ShouldBe([WatcherUuid]);
    }

    [Fact]
    public void Ta_sama_osoba_wzmiankowana_dwa_razy_liczy_sie_raz()
    {
        var body = $"""<p><span data-mention-uuid="{WatcherUuid}">@Jan</span> i jeszcze <span data-mention-uuid="{WatcherUuid}">@Jan</span></p>""";

        IssueMentions.Extract(body).Count.ShouldBe(1);
    }

    [Fact]
    public void Sam_tekst_z_malpa_nie_jest_wzmianka()
    {
        // Parsowanie po tekście („@Jan") wysyłałoby powiadomienia nie tym osobom — imion
        // powtarzalnych jest w firmie mnóstwo.
        IssueMentions.Extract("<p>napisz do @Jan albo na jan@example.com</p>").ShouldBeEmpty();
    }

    [Fact]
    public void Pusta_tresc_nie_ma_wzmianek()
    {
        IssueMentions.Extract(null).ShouldBeEmpty();
        IssueMentions.Extract("   ").ShouldBeEmpty();
    }

    [Fact]
    public void Praca_zalogowana_miesci_sie_w_dobie()
    {
        var act = () => WorkLog.Create(Guid.CreateVersion7(), ReporterUuid, minutes: 24 * 60 + 1, note: null, Now, Now);

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.work_log_minutes_invalid");
    }

    [Fact]
    public void Praca_zalogowana_wymaga_dodatniego_czasu()
    {
        var act = () => WorkLog.Create(Guid.CreateVersion7(), ReporterUuid, minutes: 0, note: null, Now, Now);

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.work_log_minutes_invalid");
    }

    [Fact]
    public void Pusta_notatka_zapisuje_sie_jako_brak()
    {
        var log = WorkLog.Create(Guid.CreateVersion7(), ReporterUuid, minutes: 30, note: "   ", Now, Now);

        log.Note.ShouldBeNull();
    }

    [Fact]
    public void Zapisany_widok_wymaga_nazwy_i_konfiguracji()
    {
        var withoutName = () => SavedIssueView.Create(ReporterUuid, "  ", "{}", "[]", isDefault: false, Now);
        var withoutPayload = () => SavedIssueView.Create(ReporterUuid, "Moje", "", "[]", isDefault: false, Now);

        withoutName.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.saved_view_name_empty");
        withoutPayload.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.saved_view_payload_empty");
    }

    [Fact]
    public void Nadpisanie_definicji_widoku_nie_zmienia_wlasciciela()
    {
        var view = SavedIssueView.Create(ReporterUuid, "Moje", "{}", "[]", isDefault: false, Now);

        view.SetDefinition("Moje pilne", """{"priority":4}""", "[]", isDefault: true, Now.AddDays(1));

        view.OwnerUuid.ShouldBe(ReporterUuid);
        view.Name.ShouldBe("Moje pilne");
        view.IsDefault.ShouldBeTrue();
        view.UpdatedAt.ShouldBe(Now.AddDays(1));
    }
}
