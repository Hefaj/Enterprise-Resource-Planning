using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.SavedViews;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyty zapisanych widoków — własne widoki wołającego plus, gdy podano projekt,
/// widoki udostępnione temu projektowi przez kogokolwiek (VIEW-001).</summary>
public sealed class SavedViewQueries : ISavedViewQueries
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public SavedViewQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public Task<List<SavedViewDto>> SearchAsync(SearchSavedViewRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var me = Guid.TryParse(_executionContext.UserId, out var userUuid) ? userUuid : Guid.Empty;

        var query = _dbContext.SavedViews.AsNoTracking().Where(v => v.OwnerUserUuid == me);

        if (request.ProjectUuid is { } projectUuid)
        {
            query = _dbContext.SavedViews.AsNoTracking()
                .Where(v => v.OwnerUserUuid == me || v.ProjectUuid == projectUuid);
        }

        return query
            .OrderBy(v => v.Name)
            .Select(v => new SavedViewDto(
                v.Uuid,
                v.OwnerUserUuid,
                v.ProjectUuid,
                v.Name,
                v.FilterJson,
                v.SortJson,
                v.Columns,
                v.Mode,
                v.OwnerUserUuid == me))
            .ToListAsync(cancellationToken);
    }
}
