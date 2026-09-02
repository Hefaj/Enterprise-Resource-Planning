using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.SavedViews;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium zapisanych widoków (VIEW-001).</summary>
public sealed class SavedViewRepository : ISavedViewRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public SavedViewRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<SavedView?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.SavedViews.FirstOrDefaultAsync(v => v.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(SavedView view) => _dbContext.SavedViews.Add(view);

    /// <inheritdoc />
    public void Remove(SavedView view) => _dbContext.SavedViews.Remove(view);
}
