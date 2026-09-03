using System.Runtime.CompilerServices;
using System.Text.Json;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Domain.Workflow;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.ReportDefinitions;

/// <summary>
/// Postęp sprintu (RPT-003, `Should`) — dla każdego sprintu: liczba kart, ile jest
/// <c>Done</c>, suma estymaty i suma zalogowanego czasu.
///
/// <para>Join <c>sprint</c> → <c>board_card</c> (po <c>SprintUuid</c>) → <c>issue</c>, plus suma
/// <c>issue_work_log.minutes</c> per sprint. <b>PERM-005 AC2/AC3</b> — wiersz niesie nazwę
/// sprintu i liczniki, nigdy tytuł ani klucz pojedynczego zgłoszenia.</para>
/// </summary>
public sealed class TaskManagementSprintProgressReportDefinition : IReportDefinition
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <inheritdoc />
    public string Key => "taskmgmt.sprint-progress";

    /// <inheritdoc />
    public IReadOnlySet<string> Formats { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "csv" };

    private readonly TaskManagementDbContext _dbContext;

    public TaskManagementSprintProgressReportDefinition(TaskManagementDbContext dbContext)
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
                    select new { card.SprintUuid, issue.StateCategory, issue.EstimateMinutes, issue.Uuid };

        var logged = from log in _dbContext.IssueWorkLogs.AsNoTracking()
                     select log;

        var source = from sprint in _dbContext.Sprints.AsNoTracking()
                     where sprintUuids.Length == 0 || sprintUuids.Contains(sprint.Uuid)
                     join board in _dbContext.Boards.AsNoTracking() on sprint.BoardUuid equals board.Uuid
                     join project in _dbContext.Projects.AsNoTracking() on board.ProjectUuid equals project.Uuid
                     select new Row(
                         project.Code,
                         sprint.Uuid,
                         sprint.Name,
                         cards.Count(c => c.SprintUuid == sprint.Uuid),
                         cards.Count(c => c.SprintUuid == sprint.Uuid && c.StateCategory == WorkflowStateCategory.Done),
                         cards.Where(c => c.SprintUuid == sprint.Uuid).Sum(c => (int?)c.EstimateMinutes) ?? 0,
                         logged.Where(l => cards.Any(c => c.SprintUuid == sprint.Uuid && c.Uuid == l.IssueUuid)).Sum(l => (int?)l.Minutes) ?? 0);

        await foreach (var row in source.AsAsyncEnumerable().WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            yield return ReportRow.Of(
                ("project_code", row.ProjectCode),
                ("sprint_uuid", row.SprintUuid),
                ("sprint_name", row.SprintName),
                ("total_count", row.TotalCount),
                ("done_count", row.DoneCount),
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
        int TotalCount,
        int DoneCount,
        int EstimateMinutesTotal,
        int LoggedMinutesTotal);
}
