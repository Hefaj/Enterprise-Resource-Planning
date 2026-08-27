using System.Linq.Expressions;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.Issues;
using TaskManagement.Infrastructure.Persistence;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>
/// Odczyty zgłoszeń — <c>AsNoTracking</c> i projekcja wprost do DTO, z pominięciem repozytoriów
/// (<c>docs/backend/cqrs.md</c>). Każde zapytanie startuje od predykatu widoczności; nie ma tu
/// ścieżki, która by go omijała.
/// </summary>
public sealed class IssueQueries : IIssueQueries
{
    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public IssueQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(SearchIssueRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var query = Filtered(request);

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await ApplySorting(query, request)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(i => i.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<Guid>> GetMatchingUuidsAsync(
        SearchIssueRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        return await Filtered(request)
            .OrderBy(i => i.Uuid)
            .Select(i => i.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<List<IssueDto>> GetAsync(
        IReadOnlyCollection<Guid>? uuids,
        CancellationToken cancellationToken)
    {
        var query = Visible();

        if (uuids is { Count: > 0 })
        {
            var uuidList = uuids.ToList();
            query = query.Where(i => uuidList.Contains(i.Uuid));
        }

        return await Project(query).ToListAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<IssueDto?> GetByKeyAsync(string key, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return null;
        }

        var normalized = key.Trim().ToUpperInvariant();

        // Klucz bieżący ma pierwszeństwo przed historycznym: po przeniesieniu zgłoszenia A do
        // innego projektu jego stary klucz może zostać nadany nowemu zgłoszeniu B. Wtedy
        // `DEV-412` musi otwierać B, a przekierowanie na A jest tylko wtedy, gdy B nie istnieje.
        var current = await Project(Visible().Where(i => i.Key == normalized))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (current is not null)
        {
            return current;
        }

        return await Project(Visible().Where(i => EF.Property<List<string>>(i, "_previousKeys").Contains(normalized)))
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    private IQueryable<Issue> Visible()
        => _dbContext.Issues
            .AsNoTracking()
            .VisibleTo(_dbContext, IssueVisibility.CurrentUser(_executionContext));

    private IQueryable<Issue> Filtered(SearchIssueRequest request)
    {
        var me = IssueVisibility.CurrentUser(_executionContext);
        var query = _dbContext.Issues.AsNoTracking().VisibleTo(_dbContext, me);

        // Brak zakresu znaczy „wszystko, co widzę" — tak samo jak `IssueScope.Available`.
        query = request.Scope switch
        {
            IssueScope.AssignedToMe => query.Where(i => i.AssigneeUuid == me),
            IssueScope.ReportedByMe => query.Where(i => i.ReporterUuid == me),
            _ => query,
        };

        if (request.ProjectUuid is { } projectUuid)
        {
            query = query.Where(i => i.ProjectUuid == projectUuid);
        }

        if (!string.IsNullOrWhiteSpace(request.Text))
        {
            var text = request.Text.Trim();

            // Szukanie obejmuje klucze historyczne — inaczej „DEV-412” z maila przestaje
            // cokolwiek znajdować dzień po przeniesieniu zgłoszenia (§4).
            query = query.Where(i => EF.Functions.ILike(i.Title, $"%{text}%")
                || EF.Functions.ILike(i.Key, $"%{text}%")
                || EF.Property<List<string>>(i, "_previousKeys").Contains(text.ToUpperInvariant()));
        }

        if (request.StateUuid is { } stateUuid)
        {
            query = query.Where(i => i.StateUuid == stateUuid);
        }

        if (request.StateCategory is { } category)
        {
            query = query.Where(i => _dbContext.WorkflowStates
                .Any(s => s.Uuid == i.StateUuid && s.Category == category));
        }

        if (request.Priority is { } priority)
        {
            query = query.Where(i => i.Priority == priority);
        }

        if (request.AssigneeUuid is { } assigneeUuid)
        {
            query = query.Where(i => i.AssigneeUuid == assigneeUuid);
        }

        return query;
    }

    private IQueryable<IssueDto> Project(IQueryable<Issue> query)
        => from issue in query
           join project in _dbContext.Projects.AsNoTracking() on issue.ProjectUuid equals project.Uuid
           join state in _dbContext.WorkflowStates.AsNoTracking() on issue.StateUuid equals state.Uuid
           select new IssueDto(
               issue.Uuid,
               issue.ProjectUuid,
               project.Code,
               issue.Key,
               issue.Title,
               issue.Description,
               issue.Priority,
               issue.StateUuid,
               state.Code,
               state.NameKey,
               state.Category,
               issue.ReporterUuid,
               issue.AssigneeUuid,
               issue.DueAt,
               issue.ParentUuid,
               issue.IsRestricted,
               issue.CreatedAt,
               issue.UpdatedAt);

    /// <summary>
    /// Whitelist sortowania. Pole spoza listy jest <b>ignorowane</b>, nie przekładane na SQL —
    /// front i backend czytają ten sam zestaw kolumn, a przełącznik projektu na liście resetuje
    /// sortowanie właśnie po to, żeby nie przyszło tu pole z poprzedniego kontekstu
    /// (<c>docs/frontend/task-management-pages.md</c> §2.1).
    /// </summary>
    private static IQueryable<Issue> ApplySorting(IQueryable<Issue> query, SearchIssueRequest request)
    {
        if (request.Sorts is null || request.Sorts.Count == 0)
        {
            // Stabilna kolejność domyślna — bez niej stronicowanie potrafi zwrócić ten sam
            // wiersz na dwóch stronach, bo Postgres nie gwarantuje kolejności.
            return query.OrderByDescending(i => i.CreatedAt).ThenBy(i => i.Uuid);
        }

        IOrderedQueryable<Issue>? ordered = null;

        foreach (var sort in request.Sorts)
        {
            var descending = sort.Order == -1;

            ordered = sort.Field.ToUpperInvariant() switch
            {
                "KEY" => Chain(ordered, query, i => i.Key, descending),
                "TITLE" => Chain(ordered, query, i => i.Title, descending),
                "PRIORITY" => Chain(ordered, query, i => i.Priority, descending),
                "DUEAT" => Chain(ordered, query, i => i.DueAt, descending),
                "CREATEDAT" => Chain(ordered, query, i => i.CreatedAt, descending),
                "UPDATEDAT" => Chain(ordered, query, i => i.UpdatedAt, descending),
                _ => ordered,
            };
        }

        return ordered is null ? query.OrderBy(i => i.Uuid) : ordered.ThenBy(i => i.Uuid);
    }

    private static IOrderedQueryable<Issue> Chain<TKey>(
        IOrderedQueryable<Issue>? ordered,
        IQueryable<Issue> query,
        Expression<Func<Issue, TKey>> selector,
        bool descending)
    {
        if (ordered is null)
        {
            return descending ? query.OrderByDescending(selector) : query.OrderBy(selector);
        }

        return descending ? ordered.ThenByDescending(selector) : ordered.ThenBy(selector);
    }
}
