using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Abstractions;
using TaskManagement.Domain.Tags;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Repositories;

/// <summary>Repozytorium tagów (TAG-001).</summary>
public sealed class TagRepository : ITagRepository
{
    private readonly TaskManagementDbContext _dbContext;

    public TagRepository(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<Tag?> FindAsync(Guid uuid, CancellationToken cancellationToken)
        => _dbContext.Tags.FirstOrDefaultAsync(t => t.Uuid == uuid, cancellationToken);

    /// <inheritdoc />
    public void Add(Tag tag) => _dbContext.Tags.Add(tag);
}
