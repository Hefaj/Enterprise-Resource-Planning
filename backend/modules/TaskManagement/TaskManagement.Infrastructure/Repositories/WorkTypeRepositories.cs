using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.WorkTypes;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium słownika rodzajów pracy (TIME-001 AC2) — wzorem <c>TagRepository</c>.</summary>
public sealed class WorkTypeRepository : IWorkTypeRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public WorkTypeRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<WorkType?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.WorkTypes.FirstOrDefaultAsync(t => t.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(WorkType workType) => _dbContext.WorkTypes.Add(workType);
}
