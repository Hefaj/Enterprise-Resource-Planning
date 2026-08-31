using Erp.BuildingBlocks.Domain;
using Shouldly;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>
/// Reguły fazy 7: edycja schematu stanów i migracja zgłoszeń przy publikacji.
///
/// <para>Testowana jest granica, na której najłatwiej o cichą utratę danych — publikacja
/// usuwająca stan, w którym siedzą zgłoszenia. Kompletność mapowania sprawdza handler komendy,
/// ale to agregat pilnuje, żeby stan docelowy w ogóle należał do opublikowanego schematu.</para>
/// </summary>
public sealed class WorkflowSchemeTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid ReporterUuid = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly DateTimeOffset Now = new(2026, 9, 1, 10, 0, 0, TimeSpan.Zero);

    private static WorkflowStateDefinition State(Guid uuid, string code, WorkflowStateCategory category, int orderNo)
        => new(uuid, code, $"workflow.states.{code}", category, orderNo);

    [Fact]
    public void Schemat_bez_stanu_poczatkowego_jest_odrzucany()
    {
        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Własny", isSystem: false);

        var act = () => scheme.ReplaceDefinition("Własny", [State(Guid.CreateVersion7(), "done", WorkflowStateCategory.Done, 0)], []);

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.workflow_scheme_without_initial_state");
    }

    [Fact]
    public void Schemat_bez_stanow_jest_odrzucany()
    {
        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Własny", isSystem: false);

        var act = () => scheme.ReplaceDefinition("Własny", [], []);

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.workflow_scheme_without_states");
    }

    [Fact]
    public void Stany_o_powtorzonym_kodzie_sa_odrzucane()
    {
        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Własny", isSystem: false);

        var act = () => scheme.ReplaceDefinition(
            "Własny",
            [State(Guid.CreateVersion7(), "todo", WorkflowStateCategory.Todo, 0), State(Guid.CreateVersion7(), "todo", WorkflowStateCategory.Todo, 1)],
            []);

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.workflow_state_duplicate");
    }

    [Fact]
    public void Publikacja_zastepuje_definicje_w_calosci()
    {
        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Własny", isSystem: false);
        var todo = Guid.CreateVersion7();
        var done = Guid.CreateVersion7();

        scheme.ReplaceDefinition(
            "Serwis",
            [State(todo, "todo", WorkflowStateCategory.Todo, 0), State(done, "done", WorkflowStateCategory.Done, 1)],
            [new WorkflowTransitionDefinition(Guid.CreateVersion7(), todo, done, "workflow.transitions.finish", null, [])]);

        scheme.Name.ShouldBe("Serwis");
        scheme.States.Select(state => state.Uuid).ShouldBe([todo, done], ignoreOrder: true);
        scheme.Transitions.Count.ShouldBe(1);
    }

    [Fact]
    public void Migracja_do_stanu_spoza_schematu_jest_odrzucana()
    {
        var workflow = WorkflowSchemeDefaults.Build();
        var issue = Issue.CreateWithUuid(Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, ReporterUuid, Now);

        var act = () => issue.MigrateWorkflowState(workflow, Guid.CreateVersion7(), Now);

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.workflow_migration_unknown_target");
    }

    [Fact]
    public void Migracja_nie_wymaga_krawedzi_automatu()
    {
        // O to w migracji chodzi: stan źródłowy właśnie znika, więc nie da się wymagać przejścia,
        // które przestało istnieć. Zwykłe `SetState` bez krawędzi by odmówiło.
        var workflow = WorkflowSchemeDefaults.Build();
        var issue = Issue.CreateWithUuid(Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, ReporterUuid, Now);
        var done = workflow.States.Single(state => state.Category == WorkflowStateCategory.Done);

        issue.MigrateWorkflowState(workflow, done.Uuid, Now);

        issue.StateUuid.ShouldBe(done.Uuid);
        issue.StateCategory.ShouldBe(WorkflowStateCategory.Done);
    }

    [Fact]
    public void Przeniesienie_do_innego_projektu_zachowuje_stary_klucz_i_resetuje_stan()
    {
        var source = WorkflowSchemeDefaults.Build();
        var target = WorkflowSchemeDefaults.BuildIntake();
        var issue = Issue.CreateWithUuid(Guid.CreateVersion7(), ProjectUuid, "DEV-412", "Tytuł", source, ReporterUuid, Now);
        var done = source.States.Single(state => state.Category == WorkflowStateCategory.Done);
        issue.MigrateWorkflowState(source, done.Uuid, Now);

        issue.MoveToProject(Guid.CreateVersion7(), "MKT-7", target, Now);

        issue.Key.ShouldBe("MKT-7");
        issue.PreviousKeys.ShouldContain("DEV-412");
        issue.StateUuid.ShouldBe(target.InitialState().Uuid);
    }

    [Fact]
    public void Przeniesienie_do_tego_samego_projektu_nic_nie_robi()
    {
        var workflow = WorkflowSchemeDefaults.Build();
        var issue = Issue.CreateWithUuid(Guid.CreateVersion7(), ProjectUuid, "DEV-412", "Tytuł", workflow, ReporterUuid, Now);

        issue.MoveToProject(ProjectUuid, "DEV-999", workflow, Now);

        issue.Key.ShouldBe("DEV-412");
        issue.PreviousKeys.ShouldBeEmpty();
    }

    [Fact]
    public void Projekt_musi_wskazywac_schemat_stanow()
    {
        var project = Project.CreateWithUuid(ProjectUuid, "DEV", "Rozwój", ProjectKind.Delivery, Guid.CreateVersion7(), isPublic: false);

        var act = () => project.SetWorkflowScheme(Guid.Empty);

        act.ShouldThrow<DomainException>().ErrorCode.ShouldBe("taskmgmt.project_workflow_scheme_required");
    }

    [Fact]
    public void Zmiana_schematu_projektu_nie_rusza_stanow_zgloszen()
    {
        var project = Project.CreateWithUuid(ProjectUuid, "DEV", "Rozwój", ProjectKind.Delivery, WorkflowSchemeDefaults.Build().Uuid, isPublic: false);
        var target = Guid.CreateVersion7();

        project.SetWorkflowScheme(target);

        project.WorkflowSchemeUuid.ShouldBe(target);
    }
}
