namespace Erp.BuildingBlocks.Reporting;

/// <summary>
/// Stan przebiegu raportu — kopia <c>ExportRunStatus</c> (patrz <c>docs/backend/reporting.md</c> §3).
///
/// <para>Celowo bez stanu pośredniego między <see cref="Running"/> a końcowymi: raport zsumowany
/// w 96% jest raportem błędnym, nie częściowym — dokładnie to samo uzasadnienie, co przy
/// eksportach (<c>docs/backend/exports-artifacts.md</c> §3).</para>
/// </summary>
public enum ReportRunStatus
{
    /// <summary>Zlecony, czeka na podjęcie przez runnera.</summary>
    Pending = 0,

    /// <summary>W trakcie — rekordy lecą do artefaktu.</summary>
    Running = 1,

    /// <summary>Zakończony, artefakt gotowy do pobrania.</summary>
    Completed = 2,

    /// <summary>Przerwany błędem; artefakt nie powstał.</summary>
    Failed = 3,
}
