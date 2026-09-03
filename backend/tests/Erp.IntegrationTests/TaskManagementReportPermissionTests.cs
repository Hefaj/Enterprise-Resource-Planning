using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Workflow;
using TaskManagement.Domain.WorkTypes;
using TaskManagement.Infrastructure.Persistence;
using TaskManagement.Infrastructure.Queries;
using TaskManagement.Infrastructure.ReportDefinitions;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// PERM-005 — jedyny automatyczny test regresyjny granicy `taskmgmt.report.read.all`
/// (dotąd weryfikowanej wyłącznie ręcznie na żywej bazie, patrz `PLAN-task-management.md` §10).
///
/// <para><b>AC3</b> — <c>taskmgmt.report.read.all</c> nigdy nie wchodzi do predykatu widoczności
/// zgłoszeń (<see cref="IssueVisibility.VisibleTo"/>). Metoda strukturalnie nie ma jak to zrobić:
/// przyjmuje wyłącznie <see cref="Guid"/> aktora, żadnych uprawnień. Test to demonstruje przez
/// wykonanie — zgłoszenie <c>is_restricted</c> jest niewidoczne dla aktora spoza kręgu, niezależnie
/// od tego, że w prawdziwym systemie ten sam aktor mógłby mieć nadane `report.read.all` (predykat
/// nigdy by o tym nie wiedział, bo nie przyjmuje takiej informacji).</para>
///
/// <para><b>AC2</b> — żadna z pięciu definicji raportu Task Management nie emituje tytułu ani
/// opisu zgłoszenia. Dla <c>issues-by-state-type-assignee</c> to <b>dowód przez wykonanie</b>:
/// definicja świadomie czyta <c>_dbContext.Issues</c> wprost (z pominięciem predykatu widoczności
/// — to jest cały sens `report.read.all`: agregaty przekrojowe, nie treść), więc zgłoszenie
/// zasiane niżej wchodzi do agregacji i test sprawdza, że mimo to jego tytuł nigdzie nie wycieka.
/// Pozostałe cztery definicje nie mają w tym teście zasianych danych źródłowych (wpis czasu poza
/// łańcuchem `Delivers`, historia zmian stanu, polityka SLA na projekcie `Intake`, sprint) — dla
/// nich test jest kontrolą strukturalną (żadna emitowana kolumna, w tym z zerowej liczby wierszy,
/// nie nazywa się `title`/`description`), nie dowodem przez wykonanie na przypadku z danymi.</para>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class TaskManagementReportPermissionTests
{
    private const string SecretTitle = "TAJNY-TYTUL-PERM-005";

    private readonly PostgresFixture _postgres;

    public TaskManagementReportPermissionTests(PostgresFixture postgres) => _postgres = postgres;

    [Fact]
    public async Task Zgloszenie_restricted_jest_niewidoczne_dla_aktora_spoza_kregu()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = await TaskManagementDatabase.CreateAsync(_postgres, ct);
        var seed = await SeedAsync(database, ct);

        await using var context = database.NewContext();
        var stranger = Guid.CreateVersion7();

        var visible = await context.Issues
            .AsNoTracking()
            .VisibleTo(context, stranger)
            .Where(i => i.Uuid == seed.IssueUuid)
            .AnyAsync(ct);

        // AC3 — predykat nie przyjmuje żadnej informacji o uprawnieniach, więc wynik jest
        // identyczny bez względu na to, czy `stranger` ma w prawdziwym systemie nadane
        // `taskmgmt.report.read.all`. Sygnatura metody sama to gwarantuje; to wywołanie jest
        // dowodem behawioralnym, nie tylko odczytem sygnatury.
        visible.ShouldBeFalse();
    }

    [Fact]
    public async Task Zaden_raport_nie_ujawnia_tytulu_ani_opisu_zgloszenia()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = await TaskManagementDatabase.CreateAsync(_postgres, ct);
        await SeedAsync(database, ct);

        await using var context = database.NewContext();

        var wideDateRange = """{"DateFrom":"2020-01-01","DateTo":"2035-01-01"}""";

        var definitions = new (string Name, IReportDefinition Definition, string? ParametersJson)[]
        {
            ("hours-by-department", new TaskManagementHoursByDepartmentReportDefinition(context), wideDateRange),
            ("issues-by-state-type-assignee", new TaskManagementIssuesByStateTypeAssigneeReportDefinition(context), null),
            ("cycle-time-by-state-category", new TaskManagementCycleTimeByStateCategoryReportDefinition(context), wideDateRange),
            ("sla-compliance", new TaskManagementSlaComplianceReportDefinition(context), wideDateRange),
            ("sprint-progress", new TaskManagementSprintProgressReportDefinition(context), null),
            ("sprint-workload", new TaskManagementSprintWorkloadReportDefinition(context), null),
        };

        var rowsSeen = 0;

        foreach (var (name, definition, parametersJson) in definitions)
        {
            await foreach (var row in definition.StreamAsync(new ReportParameters(parametersJson, "csv"), ct))
            {
                rowsSeen++;

                foreach (var (column, value) in row.Cells)
                {
                    column.ShouldNotContain("title", Case.Insensitive, $"[{name}] kolumna `{column}` wygląda jak tytuł zgłoszenia");
                    column.ShouldNotContain("description", Case.Insensitive, $"[{name}] kolumna `{column}` wygląda jak opis zgłoszenia");

                    (value?.ToString() ?? string.Empty).ShouldNotContain(SecretTitle, Case.Sensitive, $"[{name}] kolumna `{column}` ujawniła tytuł zgłoszenia");
                }
            }
        }

        // `issues-by-state-type-assignee` zawsze emituje co najmniej jeden wiersz dla zasianego
        // zgłoszenia (czyta agregaty bez filtra widoczności) — jeśli test przeszedłby z zerem
        // wierszy widzianych w ogóle, to znaczyłoby, że seed jest zepsuty, nie że granica działa.
        rowsSeen.ShouldBeGreaterThan(0);
    }

    private static async Task<(Guid IssueUuid, Guid ProjectUuid)> SeedAsync(TaskManagementDatabase database, CancellationToken ct)
    {
        await using var context = database.NewContext();

        var scheme = WorkflowScheme.CreateWithUuid(Guid.CreateVersion7(), "Domyślny", true);
        var todoUuid = Guid.CreateVersion7();
        var doneUuid = Guid.CreateVersion7();
        scheme.AddState(todoUuid, "todo", "state.todo", WorkflowStateCategory.Todo, 0);
        scheme.AddState(doneUuid, "done", "state.done", WorkflowStateCategory.Done, 1);
        scheme.AddTransition(Guid.CreateVersion7(), todoUuid, doneUuid, "transition.finish");

        var typeScheme = IssueTypeScheme.CreateWithUuid(Guid.CreateVersion7(), "Domyślny", true);
        var typeUuid = Guid.CreateVersion7();
        typeScheme.AddType(typeUuid, "task", "Zadanie", null, "list", IssueTypeCategory.Standard, 0);

        var project = Project.CreateWithUuid(
            Guid.CreateVersion7(), "SEC", "Bezpieczne", ProjectKind.Delivery, scheme.Uuid, typeScheme.Uuid, true);

        var now = DateTimeOffset.UtcNow;
        var reporter = Guid.CreateVersion7();
        var issue = Issue.CreateWithUuid(
            Guid.CreateVersion7(), project.Uuid, "SEC-1", SecretTitle, scheme, typeScheme.Types[0], reporter, now);
        issue.SetRestricted(true, now);

        var workType = WorkType.CreateWithUuid(Guid.CreateVersion7(), null, "Rozwój");
        var workLog = IssueWorkLog.CreateWithUuid(
            Guid.CreateVersion7(), issue.Uuid, reporter, workType.Uuid, DateOnly.FromDateTime(now.UtcDateTime), 30, null, now);

        context.WorkflowSchemes.Add(scheme);
        context.IssueTypeSchemes.Add(typeScheme);
        context.Projects.Add(project);
        context.Issues.Add(issue);
        context.WorkTypes.Add(workType);
        context.IssueWorkLogs.Add(workLog);

        await context.SaveChangesAsync(ct).ConfigureAwait(false);

        return (issue.Uuid, project.Uuid);
    }
}
