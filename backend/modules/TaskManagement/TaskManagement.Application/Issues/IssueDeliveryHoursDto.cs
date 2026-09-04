namespace TaskManagement.Application.Issues;

/// <summary>
/// Jeden wykonawca w rozliczeniu godzin zagadnienia (TIME-004).
///
/// <para><see cref="SharedWithOtherRequestsCount"/> &gt; 0 znaczy, że to samo zgłoszenie
/// wykonawcze realizuje TAKŻE inne zlecenie (drugie wychodzące powiązanie <c>Delivers</c>) —
/// zsumowanie minut tego wpisu z rozliczeniem obu zleceń naraz da nadmiar (AC3). Rozstrzygnięcie,
/// jak to pokazać, należy do raportu (faza 7); to zapytanie tylko jawnie niesie fakt.</para>
/// </summary>
public sealed record IssueDeliveryHoursEntryDto(
    Guid ExecutionIssueUuid,
    string ExecutionIssueKey,
    Guid ProjectUuid,
    string ProjectCode,
    string ProjectName,
    int Minutes,
    int SharedWithOtherRequestsCount);

/// <summary>Rozliczenie godzin jednego zagadnienia — suma po całym łańcuchu <c>Delivers</c>,
/// nie tylko po projekcie, w którym wpis powstał (TIME-004 AC1).</summary>
public sealed record IssueDeliveryHoursSummaryDto(
    Guid RequestIssueUuid,
    List<IssueDeliveryHoursEntryDto> Entries,
    int TotalMinutes);

/// <summary>
/// Odczyt rozliczenia godzin po łańcuchu realizacji.
///
/// <para>Pisane w fazie 6, nie 7 (razem z pierwszym wpisem czasu) — kształt tego zapytania
/// decyduje, jakich indeksów potrzebuje <c>issue_link</c>/<c>issue_work_log</c>, a raport
/// (faza 7) tylko go woła (<c>docs/modules/task-management/requirements.md</c> §14).</para>
/// </summary>
public interface IIssueDeliveryHoursQueries
{
    Task<IssueDeliveryHoursSummaryDto> GetAsync(Guid requestIssueUuid, CancellationToken cancellationToken);
}
