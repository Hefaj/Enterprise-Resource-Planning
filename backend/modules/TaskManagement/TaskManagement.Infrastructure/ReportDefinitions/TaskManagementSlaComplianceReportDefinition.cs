using System.Runtime.CompilerServices;
using System.Text.Json;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Domain.Projects;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.ReportDefinitions;

/// <summary>
/// Dotrzymanie SLA zleceń (RPT-003, `Should`) — wyłącznie projekty <see cref="ProjectKind.Intake"/>
/// z ustawioną polityką SLA (PRJ-006, faza 5).
///
/// <para><b>Proxy na „pierwszą reakcję"</b>: moment pierwszej aktywności zgłoszenia innej niż
/// <c>Created</c> — nie ma w module dedykowanego zdarzenia „pierwsza odpowiedź", więc dowolna
/// zmiana pola, stanu, komentarz czy załącznik liczy się jako reakcja. <b>Proxy na
/// „realizację"</b>: moment ostatniego przejścia do stanu z kategorią <see cref="TaskManagement.Domain.Workflow.WorkflowStateCategory.Done"/>,
/// pod warunkiem że zgłoszenie <b>wciąż</b> jest w tej kategorii dziś (reotwarcie po zamknięciu
/// cofa zgłoszenie do stanu „bez rozstrzygnięcia" na potrzeby tego raportu — świadoma decyzja,
/// bo ponowne otwarcie oznacza, że pierwsze zamknięcie było błędne).</para>
///
/// <para>Zgodność liczy się w <b>minutach roboczych</b> wg <see cref="Project.SlaWorkingDays"/>/
/// <see cref="Project.SlaWorkStartTime"/>/<see cref="Project.SlaWorkEndTime"/> — liczone
/// iteracyjnie po stronie .NET (<see cref="WorkingMinutesBetween"/>), nie w SQL: kalendarz roboczy
/// z dziurami (weekendy, godziny) jest naturalniejszy jako pętla dzień-po-dniu niż jako wyrażenie
/// SQL, a liczba zgłoszeń Intake w jednym okresie nie jest na tyle duża, żeby to zabolało.</para>
///
/// <para><b>PERM-005 AC2/AC3</b> — <see cref="Row"/> niesie wyłącznie zbiorcze liczniki per
/// projekt i okres, żadnego identyfikatora ani treści pojedynczego zgłoszenia.</para>
/// </summary>
public sealed class TaskManagementSlaComplianceReportDefinition : IReportDefinition
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <summary>Bezpiecznik pętli kalendarza roboczego — więcej niż rok liczenia dzień-po-dniu
    /// sygnalizuje dane wejściowe spoza rozsądnego zakresu, nie realny przypadek SLA.</summary>
    private const int MaxCalendarDays = 400;

    /// <inheritdoc />
    public string Key => "taskmgmt.sla-compliance";

    /// <inheritdoc />
    public IReadOnlySet<string> Formats { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "csv" };

    private readonly TaskManagementDbContext _dbContext;

    public TaskManagementSlaComplianceReportDefinition(TaskManagementDbContext dbContext)
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
                 select
                     i.uuid as issue_uuid,
                     p.uuid as project_uuid,
                     p.code as project_code,
                     i.created_at as created_at,
                     (
                         select min(a.occurred_at)
                         from taskmgmt.issue_activity a
                         where a.issue_uuid = i.uuid and a.kind <> 0
                     ) as first_response_at,
                     case when i.state_category = 'Done' then (
                         select max(a.occurred_at)
                         from taskmgmt.issue_activity a
                         where a.issue_uuid = i.uuid and a.kind = 2 and a.field_code = 'state'
                             and a.new_value = i.state_uuid::text
                     ) else null end as resolved_at,
                     p.sla_response_minutes as sla_response_minutes,
                     p.sla_resolution_minutes as sla_resolution_minutes,
                     p.sla_working_days as sla_working_days,
                     p.sla_work_start_time as sla_work_start_time,
                     p.sla_work_end_time as sla_work_end_time
                 from taskmgmt.issue i
                 join taskmgmt.project p on p.uuid = i.project_uuid
                 where p.kind = 'Intake'
                     and p.sla_response_minutes is not null
                     and i.created_at >= {filter.DateFrom.Value} and i.created_at <= {filter.DateTo.Value}
                     and (cardinality({projectUuids}) = 0 or i.project_uuid = any({projectUuids}))
                 """)
            .AsNoTracking()
            .AsAsyncEnumerable();

        var buckets = new Dictionary<(Guid ProjectUuid, DateOnly Period), Bucket>();

        await foreach (var row in source.WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            var workingDays = ParseWorkingDays(row.SlaWorkingDays);
            var period = new DateOnly(row.CreatedAt.Year, row.CreatedAt.Month, 1);
            var key = (row.ProjectUuid, period);

            if (!buckets.TryGetValue(key, out var bucket))
            {
                bucket = new Bucket(row.ProjectCode);
                buckets[key] = bucket;
            }

            bucket.Total++;

            if (row.FirstResponseAt is { } responseAt)
            {
                var responseMinutes = WorkingMinutesBetween(
                    row.CreatedAt, responseAt, workingDays, row.SlaWorkStartTime, row.SlaWorkEndTime);

                if (responseMinutes <= row.SlaResponseMinutes)
                {
                    bucket.WithinResponse++;
                }
            }

            if (row.ResolvedAt is { } resolvedAt && row.SlaResolutionMinutes is { } resolutionMinutes)
            {
                var resolutionMinutesActual = WorkingMinutesBetween(
                    row.CreatedAt, resolvedAt, workingDays, row.SlaWorkStartTime, row.SlaWorkEndTime);

                if (resolutionMinutesActual <= resolutionMinutes)
                {
                    bucket.WithinResolution++;
                }
            }
        }

        foreach (var ((_, period), bucket) in buckets.OrderBy(b => b.Value.ProjectCode).ThenBy(b => b.Key.Period))
        {
            cancellationToken.ThrowIfCancellationRequested();

            yield return ReportRow.Of(
                ("project_code", bucket.ProjectCode),
                ("period", period),
                ("total_count", bucket.Total),
                ("within_response_sla_count", bucket.WithinResponse),
                ("within_resolution_sla_count", bucket.WithinResolution));
        }
    }

    /// <summary>Minuty robocze między dwa znaczniki czasu wg kalendarza SLA — iteracja dzień po
    /// dniu, sumując nakładanie się okna dnia na okno robocze (<paramref name="workStart"/>–
    /// <paramref name="workEnd"/>) w dniach należących do <paramref name="workingDays"/>.</summary>
    private static int WorkingMinutesBetween(
        DateTimeOffset from,
        DateTimeOffset to,
        SlaWorkingDays workingDays,
        TimeOnly? workStart,
        TimeOnly? workEnd)
    {
        if (to <= from || workStart is null || workEnd is null)
        {
            return 0;
        }

        var start = workStart.Value;
        var end = workEnd.Value;
        var minutes = 0;
        var cursor = from.Date;
        var lastDay = to.Date;
        var days = 0;

        while (cursor <= lastDay && days < MaxCalendarDays)
        {
            if (IsWorkingDay(cursor, workingDays))
            {
                var dayStart = cursor.Add(start.ToTimeSpan());
                var dayEnd = cursor.Add(end.ToTimeSpan());

                var windowStart = cursor == from.Date && from.DateTime > dayStart ? from.DateTime : dayStart;
                var windowEnd = cursor == lastDay && to.DateTime < dayEnd ? to.DateTime : dayEnd;

                if (windowEnd > windowStart)
                {
                    minutes += (int)(windowEnd - windowStart).TotalMinutes;
                }
            }

            cursor = cursor.AddDays(1);
            days++;
        }

        return minutes;
    }

    private static bool IsWorkingDay(DateTime day, SlaWorkingDays workingDays)
    {
        var flag = day.DayOfWeek switch
        {
            DayOfWeek.Monday => SlaWorkingDays.Monday,
            DayOfWeek.Tuesday => SlaWorkingDays.Tuesday,
            DayOfWeek.Wednesday => SlaWorkingDays.Wednesday,
            DayOfWeek.Thursday => SlaWorkingDays.Thursday,
            DayOfWeek.Friday => SlaWorkingDays.Friday,
            DayOfWeek.Saturday => SlaWorkingDays.Saturday,
            _ => SlaWorkingDays.Sunday,
        };

        return (workingDays & flag) != 0;
    }

    private static SlaWorkingDays ParseWorkingDays(string? value)
        => Enum.TryParse<SlaWorkingDays>(value, out var parsed) ? parsed : SlaWorkingDays.None;

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
        public Guid IssueUuid { get; init; }

        public Guid ProjectUuid { get; init; }

        public string ProjectCode { get; init; } = string.Empty;

        public DateTimeOffset CreatedAt { get; init; }

        public DateTimeOffset? FirstResponseAt { get; init; }

        public DateTimeOffset? ResolvedAt { get; init; }

        public int SlaResponseMinutes { get; init; }

        public int? SlaResolutionMinutes { get; init; }

        public string? SlaWorkingDays { get; init; }

        public TimeOnly? SlaWorkStartTime { get; init; }

        public TimeOnly? SlaWorkEndTime { get; init; }
    }

    private sealed class Bucket(string projectCode)
    {
        public string ProjectCode { get; } = projectCode;

        public int Total { get; set; }

        public int WithinResponse { get; set; }

        public int WithinResolution { get; set; }
    }
}
