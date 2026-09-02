using Erp.BuildingBlocks.Reporting;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium przebiegów raportu oparte na EF Core.</summary>
public sealed class ReportRunRepository : IReportRunRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public ReportRunRepository(TaskManagementDbContext dbContext)
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
