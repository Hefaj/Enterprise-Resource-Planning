using Catalog.Application.Abstractions;
using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Repositories;

/// <summary>Repozytorium przebiegów raportu oparte na EF Core.</summary>
public sealed class ReportRunRepository : IReportRunRepository
{
    private readonly CatalogDbContext _dbContext;

    public ReportRunRepository(CatalogDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task AddAsync(ReportRun run, CancellationToken cancellationToken)
        => await _dbContext.ReportRuns.AddAsync(run, cancellationToken).ConfigureAwait(false);

    /// <inheritdoc />
    public async Task<ReportRun?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => await _dbContext.ReportRuns
            .FirstOrDefaultAsync(r => r.Uuid == uuid, cancellationToken)
            .ConfigureAwait(false);
}
