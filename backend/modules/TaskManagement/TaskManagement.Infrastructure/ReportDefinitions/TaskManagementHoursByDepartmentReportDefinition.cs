using System.Runtime.CompilerServices;
using System.Text.Json;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Domain.Issues;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.ReportDefinitions;

/// <summary>
/// Rozliczenie godzin per dział — ekran kierownictwa (RPT-002, `Must`).
///
/// <para>Wiersze: dział (projekt wykonawczy) × zagadnienie × okres (miesiąc), suma godzin
/// z <c>work_log</c>. „Zagadnienie" to zlecenie (albo zgłoszenie samo w sobie, gdy nie realizuje
/// żadnego zlecenia) — <b>TIME-004 AC2</b>: godziny zalogowane na zgłoszeniu wykonawczym, które
/// realizuje zlecenie (łańcuch <see cref="IssueLinkType.Delivers"/>, „realizuje"), liczą się do
/// zagadnienia NA KOŃCU tego łańcucha, nie do samego zgłoszenia wykonawczego. Kształt zapytania
/// jest lustrzanym odbiciem <c>IssueDeliveryHoursQueries</c> (faza 6) — tam CTE schodzi WSTECZ
/// od zlecenia do jego realizacji, tu schodzi W PRZÓD od wpisu czasu do zlecenia, które ten wpis
/// ostatecznie zasila; ten sam limit głębokości <see cref="MaxDepth"/> z tego samego powodu.</para>
///
/// <para><b>PERM-005 AC2/AC3</b> — granica raportu: wiersze niosą kod działu i KLUCZ zagadnienia
/// (np. <c>LOG-14</c>), nigdy tytuł ani opis zgłoszenia. <see cref="HoursByDepartmentRow"/> nie ma
/// pola na żadne z nich — to wymuszone przez kształt DTO, nie przez filtr w warstwie wyżej.</para>
///
/// <para><b>AC4</b> — „brak danych" kontra „zero godzin": zapytanie nie generuje wiersza
/// zerowego dla kombinacji dział×zagadnienie bez ani jednego wpisu w okresie (brak
/// <c>LEFT JOIN</c> z listą wszystkich możliwych zagadnień) — nieobecność wiersza JEST odpowiedzią
/// „brak danych"; front nie ma jak pomylić tego z wierszem niosącym <c>0</c>.</para>
///
/// <para>Zawężenie do działów wołającego (rola <c>Lead</c> zamiast <c>taskmgmt.report.read.all</c>)
/// jest decyzją WARSTWY WYŻEJ (endpoint), nie tej definicji — <see cref="HoursByDepartmentParameters.DepartmentUuids"/>
/// to zwykły filtr, ten sam mechanizm serwuje oba przypadki: pusty/brak = wszystkie działy,
/// niepusty = tylko wskazane.</para>
/// </summary>
public sealed class TaskManagementHoursByDepartmentReportDefinition : IReportDefinition
{
    /// <summary>Patrz uzasadnienie identycznego limitu w <c>IssueDeliveryHoursQueries.MaxDepth</c>.</summary>
    private const int MaxDepth = 64;

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <inheritdoc />
    public string Key => "taskmgmt.hours-by-department";

    /// <inheritdoc />
    public IReadOnlySet<string> Formats { get; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "csv" };

    private readonly TaskManagementDbContext _dbContext;

    public TaskManagementHoursByDepartmentReportDefinition(TaskManagementDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    /// <remarks>
    /// Odmowa PRZED założeniem przebiegu, gdy brak zakresu dat (<c>docs/architecture/reporting.md</c>
    /// §5.4) — bez tego raport zsumowałby cały <c>work_log</c> od początku istnienia projektu za
    /// każdym razem, gdy ktoś zapomni podać filtru.
    /// </remarks>
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
            // Backstop — `ReportRunner` woła zawsze `EstimateAsync` przed założeniem przebiegu,
            // ale definicja nie ufa wyłącznie temu wywołującemu, tak samo jak `Issue.SetState`
            // nie ufa wyłącznie temu, że front sprawdził wymagane pola przed wysłaniem komendy.
            yield break;
        }

        var delivers = IssueLinkType.Delivers.ToString();
        var departmentUuids = filter.DepartmentUuids ?? [];

        var source = _dbContext.Database
            .SqlQuery<HoursByDepartmentRow>(
                $"""
                 with recursive chain as (
                     select
                         wl.uuid as work_log_uuid,
                         wl.issue_uuid as execution_uuid,
                         wl.issue_uuid as current_uuid,
                         wl.minutes as minutes,
                         wl.logged_on as logged_on,
                         0 as depth
                     from taskmgmt.issue_work_log wl
                     where wl.logged_on >= {filter.DateFrom.Value} and wl.logged_on <= {filter.DateTo.Value}
                     union all
                     select
                         chain.work_log_uuid,
                         chain.execution_uuid,
                         l.target_uuid,
                         chain.minutes,
                         chain.logged_on,
                         chain.depth + 1
                     from chain
                     join taskmgmt.issue_link l
                         on l.source_uuid = chain.current_uuid and l.type = {delivers}
                     where chain.depth < {MaxDepth}
                 ),
                 terminal as (
                     select
                         c.work_log_uuid,
                         c.execution_uuid,
                         c.current_uuid as zagadnienie_uuid,
                         c.minutes,
                         c.logged_on,
                         row_number() over (partition by c.work_log_uuid order by c.depth desc) as rn
                     from chain c
                     where not exists (
                         select 1
                         from taskmgmt.issue_link l2
                         where l2.source_uuid = c.current_uuid and l2.type = {delivers}
                     )
                 )
                 select
                     p.uuid as department_uuid,
                     p.code as department_code,
                     p.name as department_name,
                     zi.uuid as zagadnienie_uuid,
                     zi.key as zagadnienie_key,
                     date_trunc('month', t.logged_on)::date as period,
                     sum(t.minutes)::int as minutes
                 from terminal t
                 join taskmgmt.issue ei on ei.uuid = t.execution_uuid
                 join taskmgmt.project p on p.uuid = ei.project_uuid
                 join taskmgmt.issue zi on zi.uuid = t.zagadnienie_uuid
                 where t.rn = 1
                     and (cardinality({departmentUuids}) = 0 or ei.project_uuid = any({departmentUuids}))
                 group by p.uuid, p.code, p.name, zi.uuid, zi.key, date_trunc('month', t.logged_on)
                 order by p.code, period, zagadnienie_key
                 """)
            .AsNoTracking()
            .AsAsyncEnumerable();

        await foreach (var row in source.WithCancellation(cancellationToken).ConfigureAwait(false))
        {
            yield return ReportRow.Of(
                ("department_code", row.DepartmentCode),
                ("department_name", row.DepartmentName),
                ("zagadnienie_key", row.ZagadnienieKey),
                ("period", row.Period),
                ("hours", Math.Round(row.Minutes / 60.0, 2)));
        }
    }

    private static HoursByDepartmentParameters ParseParameters(ReportParameters parameters)
    {
        if (string.IsNullOrWhiteSpace(parameters.ParametersJson))
        {
            return new HoursByDepartmentParameters(null, null, null);
        }

        return JsonSerializer.Deserialize<HoursByDepartmentParameters>(parameters.ParametersJson, JsonOptions)
            ?? new HoursByDepartmentParameters(null, null, null);
    }

    private sealed record HoursByDepartmentParameters(DateOnly? DateFrom, DateOnly? DateTo, Guid[]? DepartmentUuids);

    private sealed class HoursByDepartmentRow
    {
        public Guid DepartmentUuid { get; init; }

        public string DepartmentCode { get; init; } = string.Empty;

        public string DepartmentName { get; init; } = string.Empty;

        public Guid ZagadnienieUuid { get; init; }

        public string ZagadnienieKey { get; init; } = string.Empty;

        public DateOnly Period { get; init; }

        public int Minutes { get; init; }
    }
}
