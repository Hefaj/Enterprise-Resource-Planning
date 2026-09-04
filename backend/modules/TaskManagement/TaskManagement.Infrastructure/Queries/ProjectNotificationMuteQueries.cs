using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Projects;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyt wyciszeń powiadomień per projekt (NTF-003) — jedyny konsument to
/// <c>IssueNotificationPublisher</c>, więc zapytanie jest celowo wąskie: jedna kolumna, jeden
/// projekt, bez widoczności/paginacji, których pełny <see cref="ProjectQueries"/> by dociągał
/// bez potrzeby.</summary>
public sealed class ProjectNotificationMuteQueries : IProjectNotificationMuteQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public ProjectNotificationMuteQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<HashSet<Guid>> GetMutedUserUuidsAsync(Guid projectUuid, CancellationToken cancellationToken)
    {
        var muted = await _dbContext.Projects
            .AsNoTracking()
            .Where(p => p.Uuid == projectUuid)
            .Select(p => EF.Property<List<Guid>>(p, "_mutedNotificationUserUuids"))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return muted is null ? [] : [.. muted];
    }
}
