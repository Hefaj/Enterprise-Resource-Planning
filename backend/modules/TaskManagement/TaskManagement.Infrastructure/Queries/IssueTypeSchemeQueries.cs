using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.IssueTypes;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>Odczyty schematów typów zgłoszeń — wzorzec identyczny jak
/// <see cref="FieldSchemeQueries"/>.</summary>
public sealed class IssueTypeSchemeQueries : IIssueTypeSchemeQueries
{
    private readonly TaskManagementDbContext _dbContext;

    public IssueTypeSchemeQueries(TaskManagementDbContext dbContext) => _dbContext = dbContext;

    /// <inheritdoc />
    public async Task<List<IssueTypeSchemeDto>> SearchAsync(
        SearchIssueTypeSchemeRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = _dbContext.IssueTypeSchemes.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Text))
        {
            var text = request.Text.Trim();
            query = query.Where(s => EF.Functions.ILike(s.Name, $"%{text}%"));
        }

        return await query
            .OrderBy(s => s.Name)
            .Select(s => new IssueTypeSchemeDto(
                s.Uuid,
                s.Name,
                s.IsSystem,
                s.Types
                    .OrderBy(t => t.OrderNo)
                    .Select(t => new IssueTypeDto(
                        t.Uuid,
                        t.Code,
                        t.Name,
                        t.NameKey,
                        t.Icon,
                        t.Category,
                        t.OrderNo,
                        t.WorkflowSchemeUuid,
                        t.FieldSchemeUuid))
                    .ToList()))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<IssueTypeSchemeDto?> GetAsync(Guid uuid, CancellationToken cancellationToken)
        => await _dbContext.IssueTypeSchemes
            .AsNoTracking()
            .Where(s => s.Uuid == uuid)
            .Select(s => new IssueTypeSchemeDto(
                s.Uuid,
                s.Name,
                s.IsSystem,
                s.Types
                    .OrderBy(t => t.OrderNo)
                    .Select(t => new IssueTypeDto(
                        t.Uuid,
                        t.Code,
                        t.Name,
                        t.NameKey,
                        t.Icon,
                        t.Category,
                        t.OrderNo,
                        t.WorkflowSchemeUuid,
                        t.FieldSchemeUuid))
                    .ToList()))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
}
