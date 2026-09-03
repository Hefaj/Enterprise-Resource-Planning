using System.Runtime.CompilerServices;
using System.Text.Json;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.ReportDefinitions;

/// <summary>
/// Czas realizacji per kategoria stanu (RPT-003, `Should`).
///
/// <para><c>Issue</c> trzyma wyłącznie kategorię <b>bieżącego</b> stanu
/// (<see cref="TaskManagement.Domain.Issues.Issue.StateCategory"/>) — historia przynależności do
/// kategorii żyje w <c>issue_activity</c> (<c>Kind = StateChanged</c>, <c>FieldCode = "state"</c>,
/// <c>OldValue</c>/<c>NewValue</c> jako tekst uuida stanu — patrz
/// <c>IssueSetStateCommandHandler</c>). Zapytanie rekonstruuje <b>zamknięte</b> okresy: dla
/// każdego przejścia okres trwa od poprzedniej granicy (poprzednie przejście, a dla pierwszego —
/// <c>Issue.CreatedAt</c>) do momentu tego przejścia, a stanem obowiązującym w tym okresie jest
/// <c>OldValue</c> tego przejścia (stan, z którego zgłoszenie wyszło). Okres <b>bieżący, jeszcze
/// otwarty</b> (od ostatniego przejścia do teraz) jest świadomie pominięty — jego czas trwania
/// nie jest jeszcze rozstrzygnięty, więc wliczenie go zaniżałoby średnią w sposób zależny wyłącznie
/// od momentu odpalenia raportu.</para>
///
/// <para><b>Uproszczenie świadome</b>: mapowanie stan→kategoria bierze się z DZISIEJSZEGO
/// <c>workflow_state.category</c>, nie z kategorii obowiązującej w chwili przejścia. Jeśli
/// kategoria stanu zmieniła się od czasu tranzycji (ktoś przesunął stan między kolumnami
/// automatu), raport klasyfikuje historyczny okres wg dzisiejszej definicji. Ten sam poziom
/// uproszczenia co przy innych miejscach planu operujących na aktualnym kształcie schematu.</para>
///
/// <para><b>PERM-005 AC2/AC3</b> — <see cref="Row"/> niesie kod projektu, kategorię i okres,
/// nigdy tytuł/opis/klucz zgłoszenia.</para>
/// </summary>
public sealed class TaskManagementCycleTimeByStateCategoryReportDefinition : IReportDefinition
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <inheritdoc />
    public string Key => "taskmgmt.cycle-time-by-state-category";

    /// <inheritdoc />
    public IReadOnlySet<string> Formats { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "csv" };

    private readonly TaskManagementDbContext _dbContext;

    public TaskManagementCycleTimeByStateCategoryReportDefinition(TaskManagementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public Task<ReportEstimate> EstimateAsync(ReportParameters parameters, CancellationToken cancellationToken)
    {
        var filter = ParseParameters(parameters);

        if (filter.DateFrom is null || filter.DateTo is null)
        {
            return Task.FromResult(ReportEstimate.Denied("taskmgmt.report_date_range_required"));
        }

        if (filter.DateTo < filter.DateFrom)
        {
            return Task.FromResult(ReportEstimate.Denied("taskmgmt.report_date_range_invalid"));
        }

        return Task.FromResult(ReportEstimate.Unbounded);
    }

    /// <inheritdoc />
    public async IAsyncEnumerable<ReportRow> StreamAsync(
        ReportParameters parameters,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var filter = ParseParameters(parameters);

        if (filter.DateFrom is null || filter.DateTo is null)
        {
            yield break;
        }

        var projectUuids = filter.ProjectUuids ?? [];

        var source = _dbContext.Database
            .SqlQuery<Row>(
                $"""
                 with ordered as (
                     select
                         a.issue_uuid,
                         a.old_value as from_state_uuid,
                         a.occurred_at,
                         lag(a.occurred_at) over (partition by a.issue_uuid order by a.occurred_at) as prev_occurred_at
                     from taskmgmt.issue_activity a
                     where a.kind = 2 and a.field_code = 'state' and a.old_value is not null
                 ),
                 periods as (
                     select
                         o.issue_uuid,
                         o.from_state_uuid::uuid as from_state_uuid,
                         coalesce(o.prev_occurred_at, i.created_at) as period_start,
                         o.occurred_at as period_end
                     from ordered o
                     join taskmgmt.issue i on i.uuid = o.issue_uuid
                 )
                 select
                     p.uuid as project_uuid,
                     p.code as project_code,
                     s.category as state_category,
                     date_trunc('month', pr.period_end)::date as period,
                     extract(epoch from (pr.period_end - pr.period_start)) / 3600.0 as hours,
                     1 as sample_count
                 from periods pr
                 join taskmgmt.issue i on i.uuid = pr.issue_uuid
                 join taskmgmt.project p on p.uuid = i.project_uuid
                 join taskmgmt.workflow_state s on s.uuid = pr.from_state_uuid
                 where pr.period_end >= {filter.DateFrom.Value} and pr.period_end <= {filter.DateTo.Value}
                     and (cardinality({projectUuids}) = 0 or i.project_uuid = any({projectUuids}))
                 """)
            .AsNoTracking()
            .AsAsyncEnumerable();

        var buckets = new Dictionary<(Guid ProjectUuid, string StateCategory, DateOnly Period), Bucket>();

        await foreach (var row in source.WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            var key = (row.ProjectUuid, row.StateCategory, row.Period);

            if (!buckets.TryGetValue(key, out var bucket))
            {
                bucket = new Bucket(row.ProjectCode);
                buckets[key] = bucket;
            }

            bucket.Hours.Add(row.Hours);
        }

        // Mediana liczona po stronie .NET, nie SQL-owym `percentile_cont` — próbek na kombinację
        // (projekt, kategoria, okres) jest najwyżej kilkaset, a agregacja i tak schodzi przez
        // pamięć procesu (bucket per kombinacja), więc drugi przejazd po Postgresie nie kupuje nic.
        foreach (var ((projectUuid, stateCategory, period), bucket) in buckets.OrderBy(b => b.Key.ProjectUuid).ThenBy(b => b.Key.Period))
        {
            cancellationToken.ThrowIfCancellationRequested();

            bucket.Hours.Sort();

            yield return ReportRow.Of(
                ("project_code", bucket.ProjectCode),
                ("state_category", stateCategory),
                ("period", period),
                ("avg_hours", Math.Round(bucket.Hours.Average(), 2)),
                ("median_hours", Math.Round(Median(bucket.Hours), 2)),
                ("sample_count", bucket.Hours.Count));
        }
    }

    private static double Median(List<double> sorted)
    {
        var count = sorted.Count;

        if (count == 0)
        {
            return 0;
        }

        var mid = count / 2;

        return count % 2 == 0 ? (sorted[mid - 1] + sorted[mid]) / 2.0 : sorted[mid];
    }

    private static Parameters ParseParameters(ReportParameters parameters)
    {
        if (string.IsNullOrWhiteSpace(parameters.ParametersJson))
        {
            return new Parameters(null, null, null);
        }

        return JsonSerializer.Deserialize<Parameters>(parameters.ParametersJson, JsonOptions)
            ?? new Parameters(null, null, null);
    }

    private sealed record Parameters(DateOnly? DateFrom, DateOnly? DateTo, Guid[]? ProjectUuids);

    private sealed class Row
    {
        public Guid ProjectUuid { get; init; }

        public string ProjectCode { get; init; } = string.Empty;

        public string StateCategory { get; init; } = string.Empty;

        public DateOnly Period { get; init; }

        public double Hours { get; init; }

        public int SampleCount { get; init; }
    }

    private sealed class Bucket(string projectCode)
    {
        public string ProjectCode { get; } = projectCode;

        public List<double> Hours { get; } = [];
    }
}
