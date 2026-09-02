using Shouldly;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Linki zewnętrzne na zgłoszeniu (API-005).</summary>
public class IssueExternalLinkTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Reporter = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly DateTimeOffset Now = new(2026, 9, 2, 12, 0, 0, TimeSpan.Zero);

    private static Issue NewIssue()
    {
        var workflow = WorkflowSchemeDefaults.Build();
        var issueType = IssueTypeSchemeDefaults.Build().DefaultType();

        return Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, issueType, Reporter, Now);
    }

    [Fact]
    public void Dopiecie_linku_dodaje_wpis()
    {
        var issue = NewIssue();

        issue.AddExternalLink("https://github.com/erp/repo/pull/1", "PR #1", Now);

        issue.ExternalLinks.Count.ShouldBe(1);
        issue.ExternalLinks[0].Url.ShouldBe("https://github.com/erp/repo/pull/1");
        issue.ExternalLinks[0].Label.ShouldBe("PR #1");
    }

    [Fact]
    public void Link_bez_pelnego_adresu_jest_odrzucany()
    {
        var issue = NewIssue();

        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(
            () => issue.AddExternalLink("not-a-url", "PR #1", Now));
    }

    [Fact]
    public void Link_bez_etykiety_jest_odrzucany()
    {
        var issue = NewIssue();

        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(
            () => issue.AddExternalLink("https://github.com/erp/repo", "  ", Now));
    }

    [Fact]
    public void Ten_sam_adres_moze_byc_dopiety_dwukrotnie()
    {
        var issue = NewIssue();

        issue.AddExternalLink("https://ci.example.com/build/1", "Build #1", Now);
        issue.AddExternalLink("https://ci.example.com/build/1", "Build #1 (retry)", Now);

        issue.ExternalLinks.Count.ShouldBe(2);
    }

    [Fact]
    public void Odpiecie_usuwa_wpis()
    {
        var issue = NewIssue();
        issue.AddExternalLink("https://github.com/erp/repo", "Repo", Now);
        var linkUuid = issue.ExternalLinks[0].Uuid;

        issue.RemoveExternalLink(linkUuid, Now);

        issue.ExternalLinks.ShouldBeEmpty();
    }

    [Fact]
    public void Odpiecie_nieznanego_linku_jest_odrzucane()
    {
        var issue = NewIssue();

        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(
            () => issue.RemoveExternalLink(Guid.CreateVersion7(), Now));
    }
}
