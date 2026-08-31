using System.Globalization;
using System.Linq.Expressions;
using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.FieldSchemes;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.FieldSchemes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
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
    private readonly IFieldSchemeQueries _fields;
    private readonly IIssueGraphQueries _graph;

    public IssueQueries(
        TaskManagementDbContext dbContext,
        IExecutionContext executionContext,
        IFieldSchemeQueries fields,
        IIssueGraphQueries graph)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
        _fields = fields;
        _graph = graph;
    }

    /// <inheritdoc />
    public async Task<SearchResponse> SearchAsync(SearchIssueRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var slots = await SlotMapAsync(request, cancellationToken).ConfigureAwait(false);
        var query = ApplyCustomFieldFilters(Filtered(request), request, slots);

        // Tryb drzewa stronicuje po KORZENIACH, nie po zgłoszeniach: strona z połową epiku
        // i kawałkiem cudzego poddrzewa nie jest drzewem.
        if (request.TreeMode)
        {
            query = query.Where(i => i.ParentUuid == null);
        }

        var totalCount = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        var uuids = await ApplySorting(query, request, slots)
            .Skip((Math.Max(request.Page, 1) - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(i => i.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        if (request.TreeMode && uuids.Count > 0)
        {
            var subtree = await _graph.GetSubtreeAsync(uuids, cancellationToken).ConfigureAwait(false);

            // Kolejność korzeni ustawia sortowanie strony, a wewnątrz poddrzewa — kolejność
            // z CTE (poziom, potem uuid). Front odtwarza zagnieżdżenie z `parentUuid`, więc
            // wystarczy mu, że przodek każdego zgłoszenia jest gdzieś na tej liście.
            var byRoot = subtree.GroupBy(r => r.RootUuid).ToDictionary(g => g.Key, g => g.ToList());

            uuids = [.. uuids.SelectMany(root =>
                byRoot.TryGetValue(root, out var nodes)
                    ? nodes.Select(n => n.Uuid)
                    : [root])];
        }

        return new SearchResponse { Uuids = uuids, TotalCount = totalCount };
    }

    /// <inheritdoc />
    public async Task<List<Guid>> GetMatchingUuidsAsync(
        SearchIssueRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var slots = await SlotMapAsync(request, cancellationToken).ConfigureAwait(false);

        return await ApplyCustomFieldFilters(Filtered(request), request, slots)
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
            IssueScope.Watched => query.Where(i => EF.Property<List<Guid>>(i, "_watchers").Contains(me)),
            IssueScope.MyProjects => query.Where(i => _dbContext.ProjectMembers.Any(m => m.ProjectUuid == i.ProjectUuid && m.UserUuid == me)),
            _ => query,
        };

        if (request.ProjectUuid is { } projectUuid)
        {
            query = query.Where(i => i.ProjectUuid == projectUuid);
        }

        if (request.ProjectKind is { } projectKind)
        {
            query = query.Where(i => _dbContext.Projects.Any(p => p.Uuid == i.ProjectUuid && p.Kind == projectKind));
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
            query = query.Where(i => i.StateCategory == category);
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
               issue.DerivedDeliveryState,
               issue.ReporterUuid,
               issue.AssigneeUuid,
               issue.DueAt,
               issue.ParentUuid,
               issue.IsRestricted,
               issue.CreatedAt,
               issue.UpdatedAt,
               EF.Property<Dictionary<string, string>>(issue, "_customFields"),
               EF.Property<List<Guid>>(issue, "_watchers").Contains(IssueVisibility.CurrentUser(_executionContext)));

    /// <summary>
    /// Mapa „kod pola → slot" dla kontekstu żądania. Pusta bez wybranego projektu: dwa schematy
    /// mogą mapować ten sam kod pola na różne kolumny, więc poza kontekstem projektu nazwa pola
    /// nie znaczy nic (<c>docs/backend/task-management.md</c> §6).
    /// </summary>
    private async Task<IReadOnlyDictionary<string, FieldSlot>> SlotMapAsync(
        SearchIssueRequest request,
        CancellationToken cancellationToken)
    {
        var needsSlots = request.CustomFields is { Count: > 0 }
            || request.Sorts is { Count: > 0 };

        if (request.ProjectUuid is not { } projectUuid || !needsSlots)
        {
            return new Dictionary<string, FieldSlot>();
        }

        return await _fields.GetProjectSlotMapAsync(projectUuid, cancellationToken).ConfigureAwait(false);
    }

    private static IQueryable<Issue> ApplyCustomFieldFilters(
        IQueryable<Issue> query,
        SearchIssueRequest request,
        IReadOnlyDictionary<string, FieldSlot> slots)
    {
        if (request.CustomFields is not { Count: > 0 })
        {
            return query;
        }

        foreach (var filter in request.CustomFields)
        {
            if (string.IsNullOrWhiteSpace(filter.Value)
                || !slots.TryGetValue(filter.Code, out var slot))
            {
                continue;
            }

            query = FilterBySlot(query, slot, filter.Value.Trim());
        }

        return query;
    }

    /// <summary>
    /// Filtr po slocie. Tekst dopasowuje się częściowo, reszta dokładnie — a wartość spoza
    /// typu (litery w polu liczbowym) <b>nie zawęża wyniku i nie wywraca żądania</b>: filtr,
    /// którego użytkownik jeszcze nie dopisał do końca, nie jest błędem.
    /// </summary>
    private static IQueryable<Issue> FilterBySlot(IQueryable<Issue> query, FieldSlot slot, string value)
    {
        switch (slot)
        {
            case FieldSlot.Text1: return query.Where(i => i.Text1 != null && EF.Functions.ILike(i.Text1, $"%{value}%"));
            case FieldSlot.Text2: return query.Where(i => i.Text2 != null && EF.Functions.ILike(i.Text2, $"%{value}%"));
            case FieldSlot.Text3: return query.Where(i => i.Text3 != null && EF.Functions.ILike(i.Text3, $"%{value}%"));
            case FieldSlot.Text4: return query.Where(i => i.Text4 != null && EF.Functions.ILike(i.Text4, $"%{value}%"));
        }

        if (slot is FieldSlot.Num1 or FieldSlot.Num2 or FieldSlot.Num3 or FieldSlot.Num4)
        {
            if (!decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var number))
            {
                return query;
            }

            return slot switch
            {
                FieldSlot.Num1 => query.Where(i => i.Num1 == number),
                FieldSlot.Num2 => query.Where(i => i.Num2 == number),
                FieldSlot.Num3 => query.Where(i => i.Num3 == number),
                _ => query.Where(i => i.Num4 == number),
            };
        }

        if (slot is FieldSlot.Date1 or FieldSlot.Date2 or FieldSlot.Date3 or FieldSlot.Date4)
        {
            if (!DateTimeOffset.TryParse(
                    value,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
                    out var date))
            {
                return query;
            }

            return slot switch
            {
                FieldSlot.Date1 => query.Where(i => i.Date1 == date),
                FieldSlot.Date2 => query.Where(i => i.Date2 == date),
                FieldSlot.Date3 => query.Where(i => i.Date3 == date),
                _ => query.Where(i => i.Date4 == date),
            };
        }

        if (slot is FieldSlot.User1 or FieldSlot.User2)
        {
            if (!Guid.TryParse(value, out var user))
            {
                return query;
            }

            return slot == FieldSlot.User1
                ? query.Where(i => i.User1 == user)
                : query.Where(i => i.User2 == user);
        }

        return query;
    }

    private static IOrderedQueryable<Issue>? SortBySlot(
        IOrderedQueryable<Issue>? ordered,
        IQueryable<Issue> query,
        string field,
        IReadOnlyDictionary<string, FieldSlot> slots,
        bool descending)
    {
        if (!slots.TryGetValue(field, out var slot))
        {
            return ordered;
        }

        return slot switch
        {
            FieldSlot.Num1 => Chain(ordered, query, i => i.Num1, descending),
            FieldSlot.Num2 => Chain(ordered, query, i => i.Num2, descending),
            FieldSlot.Num3 => Chain(ordered, query, i => i.Num3, descending),
            FieldSlot.Num4 => Chain(ordered, query, i => i.Num4, descending),
            FieldSlot.Text1 => Chain(ordered, query, i => i.Text1, descending),
            FieldSlot.Text2 => Chain(ordered, query, i => i.Text2, descending),
            FieldSlot.Text3 => Chain(ordered, query, i => i.Text3, descending),
            FieldSlot.Text4 => Chain(ordered, query, i => i.Text4, descending),
            FieldSlot.Date1 => Chain(ordered, query, i => i.Date1, descending),
            FieldSlot.Date2 => Chain(ordered, query, i => i.Date2, descending),
            FieldSlot.Date3 => Chain(ordered, query, i => i.Date3, descending),
            FieldSlot.Date4 => Chain(ordered, query, i => i.Date4, descending),
            FieldSlot.User1 => Chain(ordered, query, i => i.User1, descending),
            FieldSlot.User2 => Chain(ordered, query, i => i.User2, descending),
            _ => ordered,
        };
    }

    /// <summary>
    /// Whitelist sortowania. Pole spoza listy jest <b>ignorowane</b>, nie przekładane na SQL —
    /// front i backend czytają ten sam zestaw kolumn, a przełącznik projektu na liście resetuje
    /// sortowanie właśnie po to, żeby nie przyszło tu pole z poprzedniego kontekstu
    /// (<c>docs/frontend/task-management-pages.md</c> §2.1).
    /// </summary>
    private static IQueryable<Issue> ApplySorting(
        IQueryable<Issue> query,
        SearchIssueRequest request,
        IReadOnlyDictionary<string, FieldSlot> slots)
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

                // Pole spoza kolumn wspólnych szukamy w profilu pól projektu. Nieznane
                // ZOSTAJE ZIGNOROWANE, nie odrzucone: przełącznik projektu na liście resetuje
                // sortowanie właśnie po to, żeby nie przyszło tu pole z poprzedniego kontekstu,
                // a wyścig między resetem a żądaniem nie ma prawa kończyć się błędem 400
                // (docs/frontend/task-management-pages.md §2.1).
                _ => SortBySlot(ordered, query, sort.Field, slots, descending),
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
