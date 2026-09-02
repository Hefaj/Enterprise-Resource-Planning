using Microsoft.EntityFrameworkCore;

namespace Erp.BuildingBlocks.Reporting;

/// <summary>
/// Kontrakt, który musi spełnić <c>DbContext</c> modułu, żeby móc wykonywać przebiegi raportów —
/// mirror <c>IJobDbContext</c>. Tabela <c>report_run</c> żyje w schemacie modułu wykonującego,
/// każdy moduł mapuje tę samą klasę <see cref="ReportRun"/> do własnej tabeli przez
/// <see cref="ReportRunConfiguration"/> (patrz komentarz przy <see cref="ReportRun"/>).
/// </summary>
public interface IReportRunDbContext
{
    DbSet<ReportRun> ReportRuns { get; }
}
