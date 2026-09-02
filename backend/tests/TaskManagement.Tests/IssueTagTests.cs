using Shouldly;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Dopinanie/odpinanie tagów na zgłoszeniu (TAG-001) — obie operacje idempotentne.</summary>
public class IssueTagTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Reporter = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid TagUuid = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly DateTimeOffset Now = new(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);

    private static Issue NewIssue()
    {
        var workflow = WorkflowSchemeDefaults.Build();
        var issueType = IssueTypeSchemeDefaults.Build().DefaultType();

        return Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, issueType, Reporter, Now);
    }

    [Fact]
    public void Dopiecie_tagu_dodaje_wpis()
    {
        var issue = NewIssue();

        issue.AddTag(TagUuid, Now);

        issue.Tags.ShouldContain(t => t.TagUuid == TagUuid);
    }

    [Fact]
    public void Ponowne_dopiecie_tego_samego_tagu_nie_duplikuje_wpisu()
    {
        var issue = NewIssue();

        issue.AddTag(TagUuid, Now);
        issue.AddTag(TagUuid, Now.AddMinutes(1));

        issue.Tags.Count(t => t.TagUuid == TagUuid).ShouldBe(1);
    }

    [Fact]
    public void Odpiecie_usuwa_wpis()
    {
        var issue = NewIssue();
        issue.AddTag(TagUuid, Now);

        issue.RemoveTag(TagUuid, Now.AddMinutes(1));

        issue.Tags.ShouldNotContain(t => t.TagUuid == TagUuid);
    }

    [Fact]
    public void Odpiecie_nieistniejacego_tagu_nic_nie_zmienia()
    {
        var issue = NewIssue();

        Should.NotThrow(() => issue.RemoveTag(TagUuid, Now));

        issue.Tags.ShouldBeEmpty();
    }
}
