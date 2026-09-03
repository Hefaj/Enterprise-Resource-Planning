using Erp.BuildingBlocks.Reporting;
using Shouldly;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Sprints;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;
using TaskManagement.Infrastructure.ReportDefinitions;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// SPR-004 — burndown liczony z <c>taskmgmt.issue_activity</c>, nie z tabeli migawek.
/// Cztery scenariusze z <c>PLAN-task-management.md</c> §Faza 8: karta bez przejścia do
/// <c>Done</c>, karta ukończona w połowie sprintu, karta, która wróciła z <c>Done</c>
/// (dokumentuje świadome uproszczenie „ukończone raz na zawsze"), oraz sprinty pomijane
/// (bez dat / status <c>Planned</c>).
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class TaskManagementSprintBurndownReportDefinitionTests
{
    private readonly PostgresFixture _postgres;

    public TaskManagementSprintBurndownReportDefinitionTests(PostgresFixture postgres) => _postgres = postgres;

    [Fact]
    public async Task Remaining_count_maleje_dopiero_dzien_po_wejsciu_w_done_i_nie_rosnie_po_powrocie()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = await TaskManagementDatabase.CreateAsync(_postgres, ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startsOn = today.AddDays(-4);
        var endsOn = today.AddDays(2);
        // Dzień, w którym karta "ukończona w połowie" wchodzi w Done — środek sprintu.
        var completedOn = startsOn.AddDays(2);

        await using (var context = database.NewContext())
        {
            var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Domyślny", true);
            var todoUuid = Guid.CreateVersion7();
            var doneUuid = Guid.CreateVersion7();
            scheme.AddState(todoUuid, "todo", "state.todo", WorkflowStateCategory.Todo, 0);
            scheme.AddState(doneUuid, "done", "state.done", WorkflowStateCategory.Done, 1);
            scheme.AddTransition(Guid.CreateVersion7(), todoUuid, doneUuid, "transition.finish");
            scheme.AddTransition(Guid.CreateVersion7(), doneUuid, todoUuid, "transition.reopen");

            var typeScheme = IssueTypeScheme.CreateWithUuid(Guid.CreateVersion7(), "Domyślny", true);
            var typeUuid = Guid.CreateVersion7();
            typeScheme.AddType(typeUuid, "task", "Zadanie", null, "list", IssueTypeCategory.Standard, 0);

            var project = Project.CreateWithUuid(
                Guid.CreateVersion7(), "BRN", "Burndown", ProjectKind.Delivery, scheme.Uuid, typeScheme.Uuid, true);

            var board = Board.CreateWithUuid(Guid.CreateVersion7(), project.Uuid, "Tablica", BoardMode.Scrum, true);

            var sprint = Sprint.CreateWithUuid(Guid.CreateVersion7(), board.Uuid, "Sprint 1", null, startsOn, endsOn);

            var reporter = Guid.CreateVersion7();
            var now = DateTimeOffset.UtcNow;

            // Raport pomija sprinty w statusie `Planned` (przed startem nie ma historii) —
            // sprint musi być aktywny, żeby wpisy `issue_activity` w ogóle miały znaczenie.
            sprint.Start(now);

            // Karta A: nigdy nie osiąga Done — liczy się w `remaining` przez cały zakres.
            var issueA = Issue.CreateWithUuid(
                Guid.CreateVersion7(), project.Uuid, "BRN-1", "Otwarte", scheme, typeScheme.Types[0], reporter, now);
            issueA.SetEstimate(60, now);
            var cardA = BoardCard.CreateWithUuid(Guid.CreateVersion7(), board.Uuid, issueA.Uuid, "a0", now);
            cardA.SetSprint(sprint.Uuid, now);

            // Karta B: przechodzi w Done w połowie sprintu — od NASTĘPNEGO dnia nie liczy się
            // już w `remaining`.
            var issueB = Issue.CreateWithUuid(
                Guid.CreateVersion7(), project.Uuid, "BRN-2", "Ukończone w połowie", scheme, typeScheme.Types[0], reporter, now);
            issueB.SetEstimate(30, now);
            var cardB = BoardCard.CreateWithUuid(Guid.CreateVersion7(), board.Uuid, issueB.Uuid, "b0", now);
            cardB.SetSprint(sprint.Uuid, now);

            var completedAtUtc = completedOn.ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc);
            var activityB = IssueActivity.Record(
                issueB.Uuid,
                IssueActivityKind.StateChanged,
                "state",
                todoUuid.ToString(),
                doneUuid.ToString(),
                reporter,
                Guid.CreateVersion7(),
                completedAtUtc,
                null);

            // Karta C: osiąga Done wcześnie, potem WRACA do In Progress — świadome uproszczenie:
            // liczy się jako ukończona od pierwszego wejścia w Done, powrót jej nie "przywraca"
            // do `remaining`.
            var issueC = Issue.CreateWithUuid(
                Guid.CreateVersion7(), project.Uuid, "BRN-3", "Wróciło z Done", scheme, typeScheme.Types[0], reporter, now);
            var cardC = BoardCard.CreateWithUuid(Guid.CreateVersion7(), board.Uuid, issueC.Uuid, "c0", now);
            cardC.SetSprint(sprint.Uuid, now);

            var firstDoneAtUtc = startsOn.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc);
            var reopenAtUtc = startsOn.AddDays(1).ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc);

            var activityC1 = IssueActivity.Record(
                issueC.Uuid, IssueActivityKind.StateChanged, "state",
                todoUuid.ToString(), doneUuid.ToString(), reporter, Guid.CreateVersion7(), firstDoneAtUtc, null);
            var activityC2 = IssueActivity.Record(
                issueC.Uuid, IssueActivityKind.StateChanged, "state",
                doneUuid.ToString(), todoUuid.ToString(), reporter, Guid.CreateVersion7(), reopenAtUtc, null);

            context.WorkflowSchemes.Add(scheme);
            context.IssueTypeSchemes.Add(typeScheme);
            context.Projects.Add(project);
            context.Boards.Add(board);
            context.Sprints.Add(sprint);
            context.Issues.AddRange(issueA, issueB, issueC);
            context.BoardCards.AddRange(cardA, cardB, cardC);
            context.IssueActivities.AddRange(activityB, activityC1, activityC2);

            await context.SaveChangesAsync(ct);
        }

        await using var readContext = database.NewContext();
        var definition = new TaskManagementSprintBurndownReportDefinition(readContext);

        var rows = new List<(DateOnly Date, int RemainingCount, int RemainingEstimateMinutes)>();

        await foreach (var row in definition.StreamAsync(new ReportParameters(null, "csv"), ct))
        {
            var cells = row.Cells.ToDictionary(c => c.Key, c => c.Value);
            rows.Add((
                (DateOnly)cells["date"]!,
                (int)cells["remaining_count"]!,
                (int)cells["remaining_estimate_minutes"]!));
        }

        rows.ShouldNotBeEmpty();

        // Dzień PRZED ukończeniem karty B — B jeszcze liczy się w `remaining`. Karta C jest już
        // wtedy wykluczona (weszła w Done dzień wcześniej) mimo późniejszego powrotu do
        // In Progress — świadome uproszczenie "ukończone raz na zawsze".
        var dayBeforeCompletion = rows.Single(r => r.Date == completedOn.AddDays(-1));
        dayBeforeCompletion.RemainingCount.ShouldBe(2); // A i B, nie C
        dayBeforeCompletion.RemainingEstimateMinutes.ShouldBe(90); // 60 (A) + 30 (B)

        // Dzień ukończenia karty B: liczy się jako gotowa "od końca tego dnia" — semantyka
        // "remaining na koniec dnia D" wyklucza kartę już w dniu, w którym osiągnęła Done.
        var onCompletionDay = rows.Single(r => r.Date == completedOn);
        onCompletionDay.RemainingCount.ShouldBe(1); // tylko A
        onCompletionDay.RemainingEstimateMinutes.ShouldBe(60); // tylko karta A (60 min)

        // Wszystkie wiersze mieszczą się w zakresie sprintu.
        rows.All(r => r.Date >= startsOn && r.Date <= endsOn).ShouldBeTrue();
    }

    [Fact]
    public async Task Sprint_bez_dat_i_sprint_planned_nie_generuja_wierszy()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = await TaskManagementDatabase.CreateAsync(_postgres, ct);

        await using (var context = database.NewContext())
        {
            var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Domyślny", true);
            scheme.AddState(Guid.CreateVersion7(), "todo", "state.todo", WorkflowStateCategory.Todo, 0);

            var typeScheme = IssueTypeScheme.CreateWithUuid(Guid.CreateVersion7(), "Domyślny", true);
            typeScheme.AddType(Guid.CreateVersion7(), "task", "Zadanie", null, "list", IssueTypeCategory.Standard, 0);

            var project = Project.CreateWithUuid(
                Guid.CreateVersion7(), "PLN", "Planned", ProjectKind.Delivery, scheme.Uuid, typeScheme.Uuid, true);

            var board = Board.CreateWithUuid(Guid.CreateVersion7(), project.Uuid, "Tablica", BoardMode.Scrum, true);

            // Sprint bez dat — jeszcze nie zaplanowany w czasie.
            var sprintNoDates = Sprint.CreateWithUuid(Guid.CreateVersion7(), board.Uuid, "Bez dat", null, null, null);

            // Sprint z datami, ale w statusie Planned (jeszcze nie wystartował).
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var sprintPlanned = Sprint.CreateWithUuid(
                Guid.CreateVersion7(), board.Uuid, "Zaplanowany", null, today, today.AddDays(5));

            context.WorkflowSchemes.Add(scheme);
            context.IssueTypeSchemes.Add(typeScheme);
            context.Projects.Add(project);
            context.Boards.Add(board);
            context.Sprints.AddRange(sprintNoDates, sprintPlanned);

            await context.SaveChangesAsync(ct);
        }

        await using var readContext = database.NewContext();
        var definition = new TaskManagementSprintBurndownReportDefinition(readContext);

        var rowCount = 0;
        await foreach (var _ in definition.StreamAsync(new ReportParameters(null, "csv"), ct))
        {
            rowCount++;
        }

        rowCount.ShouldBe(0);
    }
}
