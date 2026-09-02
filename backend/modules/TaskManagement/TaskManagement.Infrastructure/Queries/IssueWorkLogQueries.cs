using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Issues;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyt wpisów czasu — widoczność dziedziczy po zgłoszeniu, wzorem
/// <c>IssueCommentQueries</c>.</summary>
public sealed class IssueWorkLogQueries : IIssueWorkLogQueries
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public IssueWorkLogQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task<List<IssueWorkLogDto>> GetByIssueAsync(Guid issueUuid, CancellationToken cancellationToken)
    {
        var me = IssueVisibility.CurrentUser(_executionContext);

        var visible = _dbContext.Issues
            .AsNoTracking()
            .VisibleTo(_dbContext, me)
            .Where(i => i.Uuid == issueUuid)
            .Select(i => i.Uuid);

        return await _dbContext.IssueWorkLogs
            .AsNoTracking()
            .Where(w => visible.Contains(w.IssueUuid))
            .OrderByDescending(w => w.LoggedOn)
            .ThenByDescending(w => w.CreatedAt)
            .Select(w => new IssueWorkLogDto(
                w.Uuid,
                w.IssueUuid,
                w.UserUuid,
                w.WorkTypeUuid,
                w.LoggedOn,
                w.Minutes,
                w.Description,
                w.CreatedAt,
                w.UserUuid == me))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
