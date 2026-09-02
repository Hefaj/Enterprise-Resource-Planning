using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Resolutions;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium rozwiązań (ISS-007).</summary>
public sealed class ResolutionRepository : IResolutionRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public ResolutionRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<Resolution?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.Resolutions.FirstOrDefaultAsync(r => r.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(Resolution resolution) => _dbContext.Resolutions.Add(resolution);
}
