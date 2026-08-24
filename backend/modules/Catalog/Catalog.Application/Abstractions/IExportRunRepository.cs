using Catalog.Domain.ExportRuns;

namespace Catalog.Application.Abstractions;

/// <summary>Dostęp do agregatu <see cref="ExportRun"/> po stronie zapisu.</summary>
public interface IExportRunRepository
{
    Task AddAsync(ExportRun run, CancellationToken cancellationToken);

    Task<ExportRun?> FindAsync(Guid uuid, CancellationToken cancellationToken);
}

/// <summary>
/// Zakłada zadanie typu <c>Reduce</c> dla przebiegu eksportu.
///
/// <para>Osobna abstrakcja, a nie bezpośrednie użycie <c>IJobStore</c>, bo tamten kontrakt jest
/// skrojony pod operacje masowe: przyjmuje listę celów i zapisuje <c>job_item</c>-y. Przebieg
/// eksportu nie ma ani jednego, ani drugiego — patrz <c>docs/backend/exports-artifacts.md</c> §3.</para>
/// </summary>
public interface IExportJobFactory
{
    /// <summary>
    /// Tworzy zadanie i zwraca jego identyfikator (jednocześnie <c>trackingID</c> dla frontendu)
    /// oraz moment wygaśnięcia, który przebieg musi przyjąć jako własny — artefakt i zadanie
    /// mają wygasać razem.
    /// </summary>
    Task<(Guid JobUuid, DateTimeOffset? ExpireOn)> CreateForExportAsync(
        Guid exportRunUuid,
        string commandType,
        string? commandJson,
        CancellationToken cancellationToken);
}
