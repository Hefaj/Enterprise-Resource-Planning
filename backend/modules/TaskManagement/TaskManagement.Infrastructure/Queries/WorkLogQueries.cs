using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Issues;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

public sealed class WorkLogQueries : IWorkLogQueries
{
    private readonly TaskManagementDbContext _db;
    private readonly IExecutionContext _context;
    public WorkLogQueries(TaskManagementDbContext db, IExecutionContext context) => (_db, _context) = (db, context);

    public async Task<IReadOnlyList<WorkLogDto>> GetForIssueAsync(Guid issueUuid, CancellationToken cancellationToken)
        => await _db.WorkLogs.AsNoTracking().Where(x => x.IssueUuid == issueUuid).OrderByDescending(x => x.LoggedAt)
            .Select(x => new WorkLogDto(x.Uuid, x.IssueUuid, x.AuthorUuid, x.Minutes, x.Note, x.LoggedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<IReadOnlyList<SavedIssueViewDto>> GetSavedViewsAsync(CancellationToken cancellationToken)
    {
        var owner = Guid.TryParse(_context.UserId, out var userUuid) ? userUuid : Guid.Empty;
        return await _db.SavedIssueViews.AsNoTracking().Where(x => x.OwnerUuid == owner)
            .OrderByDescending(x => x.IsDefault).ThenBy(x => x.Name)
            .Select(x => new SavedIssueViewDto(x.Uuid, x.Name, x.FilterJson, x.ColumnsJson, x.IsDefault))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }
}
