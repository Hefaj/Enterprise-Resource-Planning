namespace Erp.BuildingBlocks.Reporting;

/// <summary>
/// Zakłada zadanie typu <c>Reduce</c> dla przebiegu raportu.
///
/// <para>Osobna abstrakcja, a nie bezpośrednie użycie <c>IJobStore</c>, z tego samego powodu co
/// przy eksportach (<c>docs/backend/exports-artifacts.md</c> §3): <c>IJobStore</c> jest skrojony
/// pod operacje masowe (lista celów, <c>job_item</c>), a przebieg raportu nie ma ani jednego,
/// ani drugiego.</para>
/// </summary>
public interface IReportJobFactory
{
    /// <summary>
    /// Tworzy zadanie i zwraca jego identyfikator (jednocześnie <c>trackingID</c> dla frontendu)
    /// oraz moment wygaśnięcia, który przebieg musi przyjąć jako własny — artefakt i zadanie
    /// mają wygasać razem.
    /// </summary>
    Task<(Guid JobUuid, DateTimeOffset? ExpireOn)> CreateForReportAsync(
        Guid reportRunUuid,
        string commandType,
        string? commandJson,
        CancellationToken cancellationToken);
}
