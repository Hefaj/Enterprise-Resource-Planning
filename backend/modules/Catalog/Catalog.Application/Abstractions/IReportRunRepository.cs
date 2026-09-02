using Erp.BuildingBlocks.Reporting;

namespace Catalog.Application.Abstractions;

/// <summary>Dostęp do agregatu <see cref="ReportRun"/> po stronie zapisu.</summary>
public interface IReportRunRepository
{
    Task AddAsync(ReportRun run, CancellationToken cancellationToken);

    Task<ReportRun?> FindAsync(Guid uuid, CancellationToken cancellationToken);
}
