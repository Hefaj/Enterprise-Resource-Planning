using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Issues;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>
/// Odczyt wątku komentarzy.
///
/// <para><b>Widoczność dziedziczy po zgłoszeniu</b>, tak samo jak przy załącznikach: dyskusja
/// nie ma własnych reguł dostępu, więc zapytanie startuje od predykatu widoczności zgłoszeń
/// i dopiero po nim schodzi do komentarzy. Ścieżki omijającej ten predykat tu nie ma.</para>
/// </summary>
public sealed class IssueCommentQueries : IIssueCommentQueries
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public IssueCommentQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task<List<IssueCommentDto>> GetByIssueAsync(Guid issueUuid, CancellationToken cancellationToken)
    {
        var me = IssueVisibility.CurrentUser(_executionContext);

        var visible = _dbContext.Issues
            .AsNoTracking()
            .VisibleTo(_dbContext, me)
            .Where(i => i.Uuid == issueUuid)
            .Select(i => i.Uuid);

        return await _dbContext.IssueComments
            .AsNoTracking()
            .Where(c => visible.Contains(c.IssueUuid))
            .OrderBy(c => c.CreatedAt)
            .ThenBy(c => c.Uuid)
            .Select(c => new IssueCommentDto(
                c.Uuid,
                c.IssueUuid,
                c.ParentUuid,
                // Treść usuniętego komentarza nie opuszcza serwera. Filtrowanie jej dopiero
                // na froncie oznaczałoby, że wystarczy zajrzeć w odpowiedź sieciową.
                c.RemovedAt == null ? c.Body : string.Empty,
                c.AuthorUuid,
                c.CreatedAt,
                c.EditedAt,
                c.RemovedAt != null))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}

/// <summary>Odczyt historii zgłoszenia — ten sam reżim widoczności co komentarze.</summary>
public sealed class IssueActivityQueries : IIssueActivityQueries
{
    /// <summary>Ile wpisów wraca na kartę. Historia zgłoszenia żyjącego rok potrafi mieć
    /// setki pozycji, a karta pokazuje ostatnie — stronicowania nie ma, bo nikt nie przewija
    /// historii do początku; kto tego potrzebuje, dostanie raport.</summary>
    private const int MaxEntries = 200;

    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public IssueActivityQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task<List<IssueActivityDto>> GetByIssueAsync(Guid issueUuid, CancellationToken cancellationToken)
    {
        var me = IssueVisibility.CurrentUser(_executionContext);

        var visible = _dbContext.Issues
            .AsNoTracking()
            .VisibleTo(_dbContext, me)
            .Where(i => i.Uuid == issueUuid)
            .Select(i => i.Uuid);

        return await _dbContext.IssueActivities
            .AsNoTracking()
            .Where(a => visible.Contains(a.IssueUuid))
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.Uuid)
            .Take(MaxEntries)
            .Select(a => new IssueActivityDto(
                a.Uuid,
                a.IssueUuid,
                a.Kind,
                a.FieldCode,
                a.OldValue,
                a.NewValue,
                a.ActorUuid,
                a.OccurredAt,
                a.AutomationRuleUuid))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }
}
