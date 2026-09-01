using Shouldly;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Obserwatorzy zgłoszenia (ISS-009). Kluczowa reguła: jawna rezygnacja jest trwała — kolejny
/// komentarz albo wzmianka, które w innym wypadku dopisałyby obserwatora automatycznie, mają
/// ją uszanować (AC1).
/// </summary>
public class IssueWatcherTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Reporter = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Watcher = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly DateTimeOffset Now = new(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);

    private static Issue NewIssue()
    {
        var workflow = WorkflowSchemeDefaults.Build();
        var issueType = IssueTypeSchemeDefaults.Build().DefaultType();

        return Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, issueType, Reporter, Now);
    }

    [Fact]
    public void Jawne_obserwowanie_dodaje_wpis()
    {
        var issue = NewIssue();

        issue.Watch(Watcher, Now);

        issue.Watchers.ShouldContain(w => w.UserUuid == Watcher && w.OptedOutAt == null);
    }

    [Fact]
    public void Domniemane_obserwowanie_dodaje_wpis_gdy_nikt_nie_zrezygnowal()
    {
        var issue = NewIssue();

        issue.WatchImplicitly(Watcher, Now);

        issue.Watchers.ShouldContain(w => w.UserUuid == Watcher && w.OptedOutAt == null);
    }

    [Fact]
    public void Rezygnacja_zostawia_wiersz_z_opted_out_at()
    {
        var issue = NewIssue();
        issue.Watch(Watcher, Now);

        issue.Unwatch(Watcher, Now.AddHours(1));

        var watcher = issue.Watchers.Single(w => w.UserUuid == Watcher);
        watcher.OptedOutAt.ShouldBe(Now.AddHours(1));
    }

    [Fact]
    public void Domniemane_obserwowanie_po_rezygnacji_nie_dopisuje_z_powrotem()
    {
        var issue = NewIssue();
        issue.Watch(Watcher, Now);
        issue.Unwatch(Watcher, Now.AddHours(1));

        issue.WatchImplicitly(Watcher, Now.AddHours(2));

        var watcher = issue.Watchers.Single(w => w.UserUuid == Watcher);
        watcher.OptedOutAt.ShouldNotBeNull();
    }

    [Fact]
    public void Jawne_ponowne_obserwowanie_czysci_rezygnacje()
    {
        var issue = NewIssue();
        issue.Watch(Watcher, Now);
        issue.Unwatch(Watcher, Now.AddHours(1));

        issue.Watch(Watcher, Now.AddHours(2));

        var watcher = issue.Watchers.Single(w => w.UserUuid == Watcher);
        watcher.OptedOutAt.ShouldBeNull();
    }
}
