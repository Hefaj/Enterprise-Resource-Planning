using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// WF-004 — „Przejście z <c>required_fields</c> otwiera modal przed wykonaniem”. Front sprawdza
/// to samo PRZED wysłaniem komendy, ale te testy dotyczą backstopu w agregacie
/// (<see cref="Issue.SetState"/>) — musi działać identycznie niezależnie od tego, czy klient
/// pominął UI, bo na tym stoi „metoda agregatu waliduje PRZED zmianą stanu”.
/// </summary>
public class WorkflowTransitionRequiredFieldsTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Reporter = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly DateTimeOffset Now = new(2026, 8, 31, 12, 0, 0, TimeSpan.Zero);

    private static readonly Guid TodoUuid = Guid.CreateVersion7();
    private static readonly Guid InProgressUuid = Guid.CreateVersion7();
    private static readonly Guid DoneUuid = Guid.CreateVersion7();

    private static WorkflowScheme SchemeWithRequiredFieldOnFinish()
    {
        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Test", isSystem: false);

        scheme.AddState(TodoUuid, "todo", "k.todo", WorkflowStateCategory.Todo, 0);
        scheme.AddState(InProgressUuid, "in_progress", "k.inProgress", WorkflowStateCategory.InProgress, 1);
        scheme.AddState(DoneUuid, "done", "k.done", WorkflowStateCategory.Done, 2);

        scheme.AddTransition(Guid.CreateVersion7(), TodoUuid, InProgressUuid, "k.start");
        scheme.AddTransition(
            Guid.CreateVersion7(), InProgressUuid, DoneUuid, "k.finish", requiredFields: ["resolution"]);
        scheme.AddTransition(Guid.CreateVersion7(), DoneUuid, InProgressUuid, "k.reopen");

        return scheme;
    }

    private static Issue IssueInProgress(WorkflowScheme workflow)
    {
        var issueType = IssueTypeSchemeDefaults.Build().DefaultType();

        var issue = Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, issueType, Reporter, Now);

        issue.SetState(workflow, InProgressUuid, Now);

        return issue;
    }

    [Fact]
    public void Przejscie_z_pustym_wymaganym_polem_jest_odrzucane()
    {
        var workflow = SchemeWithRequiredFieldOnFinish();
        var issue = IssueInProgress(workflow);

        Should.Throw<DomainException>(() => issue.SetState(workflow, DoneUuid, Now))
            .ErrorCode.ShouldBe("taskmgmt.required_fields_missing");

        issue.StateUuid.ShouldBe(InProgressUuid);
    }

    [Fact]
    public void Przejscie_z_uzupelnionym_wymaganym_polem_konczy_sie_sukcesem()
    {
        var workflow = SchemeWithRequiredFieldOnFinish();
        var issue = IssueInProgress(workflow);

        // ISS-007: `resolution` jest polem pierwszej klasy (`Issue.ResolutionUuid`), nie
        // pozycją w `custom_fields` — ustawia się przez `SetResolution`, nie `SetCustomFields`.
        issue.SetResolution(Guid.CreateVersion7(), Now);
        issue.SetState(workflow, DoneUuid, Now);

        issue.StateUuid.ShouldBe(DoneUuid);
    }

    [Fact]
    public void Brak_ustawionego_rozwiazania_liczy_sie_jako_brak()
    {
        var workflow = SchemeWithRequiredFieldOnFinish();
        var issue = IssueInProgress(workflow);

        Should.Throw<DomainException>(() => issue.SetState(workflow, DoneUuid, Now))
            .ErrorCode.ShouldBe("taskmgmt.required_fields_missing");
    }

    [Fact]
    public void Powrot_ze_stanu_done_czysci_rozwiazanie()
    {
        var workflow = SchemeWithRequiredFieldOnFinish();
        var issue = IssueInProgress(workflow);

        issue.SetResolution(Guid.CreateVersion7(), Now);
        issue.SetState(workflow, DoneUuid, Now);
        issue.ResolutionUuid.ShouldNotBeNull();

        issue.SetState(workflow, InProgressUuid, Now);

        issue.ResolutionUuid.ShouldBeNull();
    }

    [Fact]
    public void Przejscie_bez_wymaganych_pol_nie_jest_ograniczone()
    {
        var workflow = SchemeWithRequiredFieldOnFinish();
        var issue = Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-2", "Tytuł", workflow,
            IssueTypeSchemeDefaults.Build().DefaultType(), Reporter, Now);

        issue.SetState(workflow, InProgressUuid, Now);

        issue.StateUuid.ShouldBe(InProgressUuid);
    }

    [Fact]
    public void Domyslny_schemat_systemowy_wymaga_resolution_na_finish()
    {
        var scheme = WorkflowSchemeDefaults.Build();

        var finish = scheme.FindTransition(
            WorkflowSchemeDefaults.InProgressStateUuid, WorkflowSchemeDefaults.DoneStateUuid);

        finish.ShouldNotBeNull();
        finish!.RequiredFields.ShouldBe(["resolution"]);
    }
}
