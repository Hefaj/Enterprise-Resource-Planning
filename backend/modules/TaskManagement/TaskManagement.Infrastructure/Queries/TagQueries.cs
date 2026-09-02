using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Tags;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyty tagów — globalne plus, gdy podano projekt, jego własne (TAG-001).</summary>
public sealed class TagQueries : ITagQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public TagQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public Task<List<TagDto>> SearchAsync(SearchTagRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.Tags.AsNoTracking().Where(t => t.ProjectUuid == null);

        if (request.ProjectUuid is { } projectUuid)
        {
            query = _dbContext.Tags.AsNoTracking().Where(t => t.ProjectUuid == null || t.ProjectUuid == projectUuid);
        }

        return query
            .OrderBy(t => t.Name)
            .Select(t => new TagDto(t.Uuid, t.ProjectUuid, t.Name, t.Color))
            .ToListAsync(cancellationToken);
    }
}
