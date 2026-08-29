using Shouldly;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;
using Xunit;

namespace TaskManagement.Tests;

/// <summary>Reguły fazy 5: termin z polityki SLA nie zużywa minut w weekend i trwała kategoria
/// stanu podąża za automatem, bo na niej opiera się częściowy indeks skanera eskalacji.</summary>
public sealed class SlaPolicyTests
{
    private static readonly Guid ProjectUuid = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid ReporterUuid = Guid.Parse("22222222-2222-2222-2222-222222222222");

    [Fact]
    public void Termin_realizacji_pomija_weekend()
    {
        var project = Project.CreateWithUuid(
            ProjectUuid, "DEV", "Rozwój", ProjectKind.Delivery, Guid.CreateVersion7(), isPublic: false);
        project.SetSlaPolicy(responseMinutes: 30, resolutionMinutes: 120);

        var dueAt = project.SlaPolicy!.CalculateResolutionDueAt(
            new DateTimeOffset(2026, 8, 28, 23, 30, 0, TimeSpan.Zero)); // piątek

        dueAt.ShouldBe(new DateTimeOffset(2026, 8, 31, 1, 30, 0, TimeSpan.Zero)); // poniedziałek
    }

    [Fact]
    public void Zmiana_stanu_aktualizuje_trwala_kategorie()
    {
        var workflow = WorkflowSchemeDefaults.Build();
        var issue = Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, ReporterUuid,
            new DateTimeOffset(2026, 8, 28, 12, 0, 0, TimeSpan.Zero));
        var done = workflow.States.Single(state => state.Category == WorkflowStateCategory.Done);

        issue.SetState(workflow, done.Uuid, new DateTimeOffset(2026, 8, 28, 13, 0, 0, TimeSpan.Zero));

        issue.StateCategory.ShouldBe(WorkflowStateCategory.Done);
    }

    [Fact]
    public void Intake_ma_osobny_automat_z_jawnym_odbiorom()
    {
        var workflow = WorkflowSchemeDefaults.BuildIntake();
        var accepted = workflow.States.Single(state => state.Uuid == WorkflowSchemeDefaults.IntakeAcceptedStateUuid);
        var acceptance = workflow.Transitions.Single(transition => transition.ToStateUuid == accepted.Uuid);

        workflow.Uuid.ShouldBe(WorkflowSchemeDefaults.DefaultSchemeUuid(ProjectKind.Intake));
        accepted.Category.ShouldBe(WorkflowStateCategory.Done);
        acceptance.RequiredPermission.ShouldBe(WorkflowSchemeDefaults.IntakeAcceptancePermission);
    }

    [Fact]
    public void Ponowne_przypomnienie_sla_w_tym_samym_dniu_jest_pomijane()
    {
        var workflow = WorkflowSchemeDefaults.Build();
        var issue = Issue.CreateWithUuid(
            Guid.CreateVersion7(), ProjectUuid, "DEV-1", "Tytuł", workflow, ReporterUuid,
            new DateTimeOffset(2026, 8, 28, 12, 0, 0, TimeSpan.Zero));
        var today = new DateOnly(2026, 8, 29);

        issue.TryMarkSlaReminder(today, new DateTimeOffset(2026, 8, 29, 8, 0, 0, TimeSpan.Zero)).ShouldBeTrue();
        issue.TryMarkSlaReminder(today, new DateTimeOffset(2026, 8, 29, 9, 0, 0, TimeSpan.Zero)).ShouldBeFalse();
    }
}
