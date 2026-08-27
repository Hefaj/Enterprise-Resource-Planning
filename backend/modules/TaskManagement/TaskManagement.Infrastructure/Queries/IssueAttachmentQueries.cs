using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Issues;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>
/// Odczyty załączników.
///
/// <para><b>Widoczność dziedziczy po zgłoszeniu</b> — plik nie ma własnych reguł dostępu.
/// Każde zapytanie startuje więc od predykatu widoczności zgłoszeń i dopiero po nim schodzi
/// do plików; nie ma tu ścieżki, która by go omijała. Bez tego link do zawartości byłby
/// obejściem całej widoczności projektowej: uuid załącznika wystarczyłby, żeby pobrać zrzut
/// ekranu ze zgłoszenia w cudzym projekcie.</para>
/// </summary>
public sealed class IssueAttachmentQueries : IIssueAttachmentQueries
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public IssueAttachmentQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task<List<IssueAttachmentDto>> GetByIssueAsync(Guid issueUuid, CancellationToken cancellationToken)
    {
        var me = IssueVisibility.CurrentUser(_executionContext);

        var visible = _dbContext.Issues
            .AsNoTracking()
            .VisibleTo(_dbContext, me)
            .Where(i => i.Uuid == issueUuid)
            .Select(i => i.Uuid);

        return await _dbContext.IssueAttachments
            .AsNoTracking()
            .Where(a => visible.Contains(a.IssueUuid))
            .OrderBy(a => a.CreatedAt)
            .ThenBy(a => a.Uuid)
            .Select(a => new IssueAttachmentDto(
                a.Uuid,
                a.IssueUuid,
                a.FileName,
                a.MimeType,
                a.FileSize,
                a.MimeType.StartsWith("image/"),
                a.UploadedByUuid,
                a.CreatedAt))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<IssueAttachmentContentRef?> GetContentRefAsync(Guid uuid, CancellationToken cancellationToken)
    {
        var me = IssueVisibility.CurrentUser(_executionContext);

        var visible = _dbContext.Issues
            .AsNoTracking()
            .VisibleTo(_dbContext, me)
            .Select(i => i.Uuid);

        return await _dbContext.IssueAttachments
            .AsNoTracking()
            .Where(a => a.Uuid == uuid && visible.Contains(a.IssueUuid))
            .Select(a => new IssueAttachmentContentRef(a.ArtifactUuid, a.FileName, a.MimeType, a.FileSize))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
