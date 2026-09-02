using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Przeniesienie zgłoszenia do innego projektu (ISS-010) — nowy klucz, stary zachowany
/// w <see cref="Issue.PreviousKeys"/>, stan zresetowany do stanu początkowego docelowego
/// schematu (ta sama mechanika, co migracja stanu przy zmianie typu — <c>Issue.SetType</c>).
/// </summary>
public class IssueMoveToProjectTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid TargetProjectUuid = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Reporter = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly DateTimeOffset Now = new(2026, 9, 2, 12, 0, 0, TimeSpan.Zero);

    private static Issue IssueInProgress(WorkflowScheme sourceScheme)
    {
        var issueType = IssueTypeSchemeDefaults.Build().DefaultType();
        var issue = Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", sourceScheme, issueType, Reporter, Now);

        issue.SetState(sourceScheme, WorkflowSchemeDefaults.InProgressStateUuid, Now);

        return issue;
    }

    [Fact]
    public void Przeniesienie_do_tego_samego_projektu_jest_noopem()
    {
        var scheme = WorkflowSchemeDefaults.Build();
        var issue = IssueInProgress(scheme);
        var keyBefore = issue.Key;

        issue.MoveToProject(ProjectUuid, "IGNORED-1", scheme, Now);

        issue.Key.ShouldBe(keyBefore);
        issue.PreviousKeys.ShouldBeEmpty();
    }

    [Fact]
    public void Przeniesienie_nadaje_nowy_klucz_i_zachowuje_stary()
    {
        var scheme = WorkflowSchemeDefaults.Build();
        var issue = IssueInProgress(scheme);

        issue.MoveToProject(TargetProjectUuid, "OPS-7", scheme, Now);

        issue.ProjectUuid.ShouldBe(TargetProjectUuid);
        issue.Key.ShouldBe("OPS-7");
        issue.PreviousKeys.ShouldContain("DEV-1");
    }

    [Fact]
    public void Przeniesienie_resetuje_stan_do_poczatkowego_docelowego_schematu()
    {
        var sourceScheme = WorkflowSchemeDefaults.Build();
        var issue = IssueInProgress(sourceScheme);

        var targetScheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Inny automat", isSystem: false);
        var targetInitial = Guid.CreateVersion7();
        targetScheme.AddState(targetInitial, "backlog", "k.backlog", WorkflowStateCategory.Todo, 0);

        issue.MoveToProject(TargetProjectUuid, "OPS-7", targetScheme, Now);

        issue.StateUuid.ShouldBe(targetInitial);
        issue.StateCategory.ShouldBe(WorkflowStateCategory.Todo);
    }

    [Fact]
    public void Przeniesienie_z_pustym_kluczem_jest_odrzucane()
    {
        var scheme = WorkflowSchemeDefaults.Build();
        var issue = IssueInProgress(scheme);

        Should.Throw<DomainException>(() => issue.MoveToProject(TargetProjectUuid, "  ", scheme, Now))
            .ErrorCode.ShouldBe("taskmgmt.issue_key_empty");
    }

    /// <summary>
    /// <c>MoveToProject</c> sam NIE dotyka pól niestandardowych — to handler komendy
    /// (<c>IssueMoveToProjectCommandHandler</c>) woła osobno <see cref="Issue.SetCustomFields"/>
    /// z przemapowanymi wartościami (ISS-010 AC4). Ten test dokumentuje właśnie tę granicę:
    /// bez drugiego wywołania stare wartości (i sloty) przeżywają przeniesienie tak jak są.
    /// </summary>
    [Fact]
    public void Samo_przeniesienie_nie_rusza_pol_niestandardowych()
    {
        var scheme = WorkflowSchemeDefaults.Build();
        var issue = IssueInProgress(scheme);

        var sourceFieldScheme = FieldScheme.CreateWithUuid(Guid.CreateVersion7(), "Źródłowy", isSystem: false);
        sourceFieldScheme.AddField(Guid.CreateVersion7(), "budget", "Budżet", "k.budget", CustomFieldDataType.Number, FieldSlot.Num1, 0);
        issue.SetCustomFields(sourceFieldScheme, new Dictionary<string, string?> { ["budget"] = "100" }, Now);

        issue.MoveToProject(TargetProjectUuid, "OPS-7", scheme, Now);

        issue.CustomFields["budget"].ShouldBe("100");
        issue.Num1.ShouldBe(100m);

        // Docelowy schemat nie zna kodu "budget" — handler decyduje, czy je odrzucić, czy
        // zmapować na inny kod (ISS-010 AC4); tu symulujemy odrzucenie wprost przez agregat,
        // bo to jest mechanizm, na którym handler się opiera.
        var targetFieldScheme = FieldScheme.CreateWithUuid(Guid.CreateVersion7(), "Docelowy", isSystem: false);
        issue.SetCustomFields(targetFieldScheme, new Dictionary<string, string?>(), Now);

        issue.CustomFields.ShouldNotContainKey("budget");
        issue.Num1.ShouldBeNull();
    }
}
