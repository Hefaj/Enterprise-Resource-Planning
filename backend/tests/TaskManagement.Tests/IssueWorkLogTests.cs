using Shouldly;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Wpis czasu (TIME-001) i estymata zgłoszenia (TIME-002).</summary>
public class IssueWorkLogTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Reporter = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid UserUuid = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid WorkTypeUuid = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly DateTimeOffset Now = new(2026, 9, 2, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = DateOnly.FromDateTime(Now.Date);

    private static Issue NewIssue()
    {
        var workflow = WorkflowSchemeDefaults.Build();
        var issueType = IssueTypeSchemeDefaults.Build().DefaultType();

        return Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, issueType, Reporter, Now);
    }

    [Fact]
    public void Zakladajac_wpis_czasu_wymaga_dodatniej_liczby_minut()
    {
        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(() => IssueWorkLog.CreateWithUuid(
            Guid.CreateVersion7(), Guid.CreateVersion7(), UserUuid, WorkTypeUuid, Today, 0, null, Now));
    }

    [Fact]
    public void Zakladajac_wpis_czasu_wymaga_rodzaju_pracy()
    {
        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(() => IssueWorkLog.CreateWithUuid(
            Guid.CreateVersion7(), Guid.CreateVersion7(), UserUuid, Guid.Empty, Today, 30, null, Now));
    }

    [Fact]
    public void Poprawny_wpis_niesie_podane_dane()
    {
        var issueUuid = Guid.CreateVersion7();

        var workLog = IssueWorkLog.CreateWithUuid(
            Guid.CreateVersion7(), issueUuid, UserUuid, WorkTypeUuid, Today, 45, "  notatka  ", Now);

        workLog.IssueUuid.ShouldBe(issueUuid);
        workLog.Minutes.ShouldBe(45);
        workLog.Description.ShouldBe("notatka");
    }

    [Fact]
    public void Estymata_domyslnie_jest_pusta()
    {
        var issue = NewIssue();

        issue.EstimateMinutes.ShouldBeNull();
    }

    [Fact]
    public void Ustawienie_estymaty_zapisuje_minuty()
    {
        var issue = NewIssue();

        issue.SetEstimate(120, Now);

        issue.EstimateMinutes.ShouldBe(120);
    }

    [Fact]
    public void Ujemna_estymata_jest_odrzucana()
    {
        var issue = NewIssue();

        Should.Throw<Erp.BuildingBlocks.Domain.DomainException>(() => issue.SetEstimate(-1, Now));
    }

    [Fact]
    public void Estymate_da_sie_wyczyscic()
    {
        var issue = NewIssue();
        issue.SetEstimate(60, Now);

        issue.SetEstimate(null, Now);

        issue.EstimateMinutes.ShouldBeNull();
    }
}
