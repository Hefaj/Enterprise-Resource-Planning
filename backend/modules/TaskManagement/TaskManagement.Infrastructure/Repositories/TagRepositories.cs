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

    /// <inheritdoc />
    public void Remove(Tag tag) => _dbContext.Tags.Remove(tag);
}

/// <summary>Przepięcie <c>issue_tag</c> przy scalaniu tagów (TAG-003) — patrz uzasadnienie przy
/// <see cref="IIssueTagWriter"/>.</summary>
public sealed class IssueTagWriter : IIssueTagWriter
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueTagWriter(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task RepointAsync(Guid fromTagUuid, Guid toTagUuid, CancellationToken cancellationToken)
    {
        // Dedup NAJPIERW: zgłoszenie, które nosi już tag docelowy, traci wiersz źródłowy zamiast
        // zderzać się z unikalnym indeksem `(issue_uuid, tag_uuid)` w kolejnym kroku.
        await _dbContext.Database.ExecuteSqlAsync(
            $"""
             DELETE FROM taskmgmt.issue_tag t1
              WHERE t1.tag_uuid = {fromTagUuid}
                AND EXISTS (
                    SELECT 1 FROM taskmgmt.issue_tag t2
                     WHERE t2.issue_uuid = t1.issue_uuid AND t2.tag_uuid = {toTagUuid}
                )
             """,
            cancellationToken).ConfigureAwait(false);

        await _dbContext.Database.ExecuteSqlAsync(
            $"""
             UPDATE taskmgmt.issue_tag
                SET tag_uuid = {toTagUuid}
              WHERE tag_uuid = {fromTagUuid}
             """,
            cancellationToken).ConfigureAwait(false);
    }
}
