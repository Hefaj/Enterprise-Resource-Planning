using System.Runtime.CompilerServices;
using System.Text.Json;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.ReportDefinitions;

/// <summary>
/// Obciążenie osób w sprincie (RPT-003, `Should`) — ten sam join co
/// <see cref="TaskManagementSprintProgressReportDefinition"/>, tyle że grupowany po
/// <c>AssigneeUuid</c> zamiast po całym sprincie naraz.
///
/// <para><b>Kontrola granicy z kadrami (`TIME-003`)</b>: dokument zabrania WYŁĄCZNIE „godzin
/// pracownika X w miesiącu" jako podmiotu raportu. To grupowanie jest inne z natury — mierzy
/// obciążenie w KONTEKŚCIE JEDNEGO SPRINTU, na potrzeby balansowania planu przez Lead/kierownika
/// projektu, nie akt personalny pracownika w czasie. Zapytanie nie ma żadnego parametru
/// obejmującego okres kalendarzowy (dokładnie odwrotnie niż <c>hours-by-department</c>) —
/// istnieje tylko w ramach sprintu, który sam ma skończony, jawny początek i koniec. Gdyby
/// przyszła zmiana miała dodać tu filtr po zakresie dat, to jest sygnał, że rozjeżdża się
/// z granicą TIME-003 i wymaga świadomej decyzji, nie cichego dopisania parametru.</para>
///
/// <para><b>PERM-005 AC2/AC3</b> — wiersz niesie identyfikator osoby i liczniki, nigdy tytuł ani
/// klucz zgłoszenia.</para>
/// </summary>
public sealed class TaskManagementSprintWorkloadReportDefinition : IReportDefinition
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <inheritdoc />
    public string Key => "taskmgmt.sprint-workload";

    /// <inheritdoc />
    public IReadOnlySet<string> Formats { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "csv" };

    private readonly TaskManagementDbContext _dbContext;

    public TaskManagementSprintWorkloadReportDefinition(TaskManagementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public Task<ReportEstimate> EstimateAsync(ReportParameters parameters, CancellationToken cancellationToken)
        => Task.FromResult(ReportEstimate.Unbounded);

    /// <inheritdoc />
    public async IAsyncEnumerable<ReportRow> StreamAsync(
        ReportParameters parameters,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var filter = ParseParameters(parameters);
        var sprintUuids = filter.SprintUuids ?? [];

        var cards = from card in _dbContext.BoardCards.AsNoTracking()
                    where card.SprintUuid != null
                    join issue in _dbContext.Issues.AsNoTracking() on card.IssueUuid equals issue.Uuid
                    select new { card.SprintUuid, issue.AssigneeUuid, issue.EstimateMinutes, issue.Uuid };

        var logged = _dbContext.IssueWorkLogs.AsNoTracking();

        var grouped = from c in cards
                      where sprintUuids.Length == 0 || c.SprintUuid == null || sprintUuids.Contains(c.SprintUuid!.Value)
                      group c by new { c.SprintUuid, c.AssigneeUuid } into g
                      select new
                      {
                          g.Key.SprintUuid,
                          g.Key.AssigneeUuid,
                          CardCount = g.Count(),
                          EstimateMinutesTotal = g.Sum(x => (int?)x.EstimateMinutes) ?? 0,
                          LoggedMinutesTotal = logged.Where(l => g.Any(x => x.Uuid == l.IssueUuid)).Sum(l => (int?)l.Minutes) ?? 0,
                      };

        var source = from g in grouped
                     join sprint in _dbContext.Sprints.AsNoTracking() on g.SprintUuid equals sprint.Uuid
                     join board in _dbContext.Boards.AsNoTracking() on sprint.BoardUuid equals board.Uuid
                     join project in _dbContext.Projects.AsNoTracking() on board.ProjectUuid equals project.Uuid
                     select new Row(
                         project.Code,
                         sprint.Uuid,
                         sprint.Name,
                         g.AssigneeUuid,
                         g.CardCount,
                         g.EstimateMinutesTotal,
                         g.LoggedMinutesTotal);

        await foreach (var row in source.AsAsyncEnumerable().WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            yield return ReportRow.Of(
                ("project_code", row.ProjectCode),
                ("sprint_uuid", row.SprintUuid),
                ("sprint_name", row.SprintName),
                ("assignee_uuid", row.AssigneeUuid),
                ("card_count", row.CardCount),
                ("estimate_minutes_total", row.EstimateMinutesTotal),
                ("logged_minutes_total", row.LoggedMinutesTotal));
        }
    }

    private static Parameters ParseParameters(ReportParameters parameters)
    {
        if (string.IsNullOrWhiteSpace(parameters.ParametersJson))
        {
            return new Parameters(null);
        }

        return JsonSerializer.Deserialize<Parameters>(parameters.ParametersJson, JsonOptions)
            ?? new Parameters(null);
    }

    private sealed record Parameters(Guid[]? SprintUuids);

    private sealed record Row(
        string ProjectCode,
        Guid SprintUuid,
        string SprintName,
        Guid? AssigneeUuid,
        int CardCount,
        int EstimateMinutesTotal,
        int LoggedMinutesTotal);
}
