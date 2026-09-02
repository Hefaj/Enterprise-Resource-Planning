using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Sprints;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium sprintów.</summary>
public sealed class SprintRepository : ISprintRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public SprintRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<Sprint?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.Sprints.FirstOrDefaultAsync(s => s.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(Sprint sprint) => _dbContext.Sprints.Add(sprint);
}
