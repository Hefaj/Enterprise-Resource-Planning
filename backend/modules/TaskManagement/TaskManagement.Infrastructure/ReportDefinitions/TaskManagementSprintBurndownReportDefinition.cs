using System.Runtime.CompilerServices;
using System.Text.Json;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.ReportDefinitions;

/// <summary>
/// Wykres burndown per sprint (SPR-004, `Could`) — dla każdego dnia sprintu: ile kart jeszcze
/// nie osiągnęło kategorii <c>Done</c> i ile estymaty im zostało.
///
/// <para><b>AC1 — liczone z historii zmian stanów, nie z osobnej tabeli migawek.</b> Źródłem
/// jest wyłącznie <c>taskmgmt.issue_activity</c> (<c>Kind = StateChanged</c>,
/// <c>FieldCode = "state"</c>) — dokładnie tak, jak
/// <see cref="TaskManagementCycleTimeByStateCategoryReportDefinition"/> rekonstruuje historię
/// cyklu życia zgłoszenia. Żaden wiersz nie jest zapisywany osobno „na później" — raport liczy
/// się od zera przy każdym uruchomieniu.</para>
///
/// <para><b>Świadome uproszczenie — „ukończone raz na zawsze".</b> Dla karty liczę
/// <c>completed_at</c> jako <b>najwcześniejszy</b> moment, w którym zgłoszenie weszło w stan
/// o (dzisiejszej) kategorii <c>Done</c>. Karta, która wraca z <c>Done</c> do <c>In Progress</c>
/// (rutynowe zdarzenie w tym systemie — patrz <c>WorkflowSchemeDefaults</c>), nadal liczy się
/// jako ukończona od pierwszego wejścia w <c>Done</c> — burndown nie śledzi ponownych otwarć.
/// Pełne śledzenie wymagałoby rekonstrukcji całej sekwencji stanów per dzień (jak w CycleTime),
/// co dla samego pytania „ile zostało" jest nadmiarowe. Ten sam poziom uproszczenia co mapowanie
/// stan→kategoria z DZISIEJSZEGO <c>workflow_state.category</c>, nie z kategorii obowiązującej
/// w chwili przejścia.</para>
///
/// <para>Zakres dni to <c>[sprint.starts_on, min(sprint.ends_on, dziś)]</c> — sprint bez obu dat
/// (jeszcze nie zaplanowany w czasie) albo w statusie <c>Planned</c> nie generuje żadnego wiersza:
/// przed startem nie ma historii do pokazania.</para>
///
/// <para><b>PERM-005 AC2/AC3</b> — <see cref="Row"/> niesie nazwę sprintu, kod projektu, dzień
/// i dwa liczniki, nigdy tytuł/opis/klucz zgłoszenia.</para>
/// </summary>
public sealed class TaskManagementSprintBurndownReportDefinition : IReportDefinition
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <inheritdoc />
    public string Key => "taskmgmt.sprint-burndown";

    /// <inheritdoc />
    public IReadOnlySet<string> Formats { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "csv" };

    private readonly TaskManagementDbContext _dbContext;

    public TaskManagementSprintBurndownReportDefinition(TaskManagementDbContext dbContext)
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

        var source = _dbContext.Database
            .SqlQuery<Row>(
                $"""
                 with target_cards as (
                     select bc.issue_uuid, bc.sprint_uuid
                     from taskmgmt.board_card bc
                     where bc.sprint_uuid is not null
                 ),
                 completed as (
                     select a.issue_uuid, min(a.occurred_at) as completed_at
                     from taskmgmt.issue_activity a
                     join taskmgmt.workflow_state s on s.uuid = a.new_value::uuid
                     where a.kind = 2 and a.field_code = 'state' and a.new_value is not null
                         and s.category = 'Done'
                     group by a.issue_uuid
                 ),
                 days as (
                     select
                         sp.uuid as sprint_uuid,
                         sp.name as sprint_name,
                         p.code as project_code,
                         gs::date as day
                     from taskmgmt.sprint sp
                     join taskmgmt.board b on b.uuid = sp.board_uuid
                     join taskmgmt.project p on p.uuid = b.project_uuid
                     cross join lateral generate_series(
                         sp.starts_on::timestamp,
                         least(sp.ends_on, current_date)::timestamp,
                         interval '1 day') as gs
                     where sp.starts_on is not null and sp.ends_on is not null and sp.status <> 'Planned'
                         and (cardinality({sprintUuids}) = 0 or sp.uuid = any({sprintUuids}))
                 )
                 select
                     d.sprint_name,
                     d.project_code,
                     d.day as date,
                     count(tc.issue_uuid) filter (
                         where c.completed_at is null or c.completed_at::date > d.day) as remaining_count,
                     coalesce(sum(i.estimate_minutes) filter (
                         where c.completed_at is null or c.completed_at::date > d.day), 0)::int
                         as remaining_estimate_minutes
                 from days d
                 join target_cards tc on tc.sprint_uuid = d.sprint_uuid
                 join taskmgmt.issue i on i.uuid = tc.issue_uuid
                 left join completed c on c.issue_uuid = tc.issue_uuid
                 group by d.sprint_name, d.project_code, d.day
                 order by d.sprint_name, d.day
                 """)
            .AsNoTracking()
            .AsAsyncEnumerable();

        await foreach (var row in source.WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            yield return ReportRow.Of(
                ("sprint_name", row.SprintName),
                ("project_code", row.ProjectCode),
                ("date", row.Date),
                ("remaining_count", row.RemainingCount),
                ("remaining_estimate_minutes", row.RemainingEstimateMinutes));
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

    private sealed class Row
    {
        public string SprintName { get; init; } = string.Empty;

        public string ProjectCode { get; init; } = string.Empty;

        public DateOnly Date { get; init; }

        public int RemainingCount { get; init; }

        public int RemainingEstimateMinutes { get; init; }
    }
}
