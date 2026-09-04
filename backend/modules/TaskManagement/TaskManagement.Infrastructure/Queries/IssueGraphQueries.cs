using System.Linq.Expressions;
using Erp.BuildingBlocks.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Application.Issues;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Infrastructure.Persistence;
using TaskManagement.Infrastructure.Persistence.Graph;

namespace TaskManagement.Infrastructure.Queries;

/// <summary>
/// Odczyty grafu zgłoszeń: hierarchia i powiązania.
///
/// <para>Trzy zapytania idą <b>rekurencyjnym CTE</b>, bo w LINQ nie da się wyrazić przejścia
/// grafu, a alternatywa — wczytanie wszystkich krawędzi do pamięci — rośnie z wiekiem projektu
/// i musi działać także w pre-checku operacji masowej
/// (<c>docs/modules/task-management/domain.md</c> §8.2).</para>
///
/// <para><b>Limit głębokości</b> jest w każdym z nich i nie jest ozdobnikiem: dane sprzed
/// wprowadzenia reguł cyklu (albo wstawione ręcznie w bazie) mogą zawierać pętlę, a rekurencyjne
/// CTE bez ograniczenia kręciłoby się wtedy w nieskończoność, zabierając połączenie ze sobą.</para>
/// </summary>
public sealed class IssueGraphQueries : IIssueGraphQueries
{
    /// <summary>Maksymalna głębokość przejścia. Drzewo epik → zadanie → podzadanie ma trzy
    /// poziomy; graf blokad bywa głębszy, ale nie o rząd wielkości.</summary>
    private const int MaxDepth = 64;

    private readonly TaskManagementDbContext _dbContext;
    private readonly IExecutionContext _executionContext;

    public IssueGraphQueries(TaskManagementDbContext dbContext, IExecutionContext executionContext)
    {
        _dbContext = dbContext;
        _executionContext = executionContext;
    }

    /// <inheritdoc />
    public async Task<IssueGraphDto> GetGraphAsync(Guid issueUuid, CancellationToken cancellationToken)
    {
        var userUuid = IssueVisibility.CurrentUser(_executionContext);

        var issue = await _dbContext.Issues
            .AsNoTracking()
            .VisibleTo(_dbContext, userUuid)
            .Where(i => i.Uuid == issueUuid)
            .Select(i => new { i.Uuid, i.ParentUuid })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (issue is null)
        {
            return new IssueGraphDto(issueUuid, null, [], []);
        }

        var parent = issue.ParentUuid is { } parentUuid
            ? await Headers(i => i.Uuid == parentUuid).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false)
            : null;

        var children = await Headers(i => i.ParentUuid == issueUuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // Powiązania z obu stron. DWA zapytania, nie jedno z warunkowym `let` — wyrażenie
        // „drugi koniec krawędzi to ten, który nie jest mną" nie ma odpowiednika w SQL i EF
        // odrzuca je jako nieprzetłumaczalne. Sklejenie w pamięci kosztuje tyle, ile dwie
        // listy o długości paska powiązań na karcie.
        //
        // Nagłówek drugiego zgłoszenia wychodzi BEZ predykatu widoczności i to jest świadome:
        // „wgląd z powiązania" (§10.1) daje zamawiającemu klucz, tytuł i stan powiązanego
        // zgłoszenia bez członkostwa w tamtym projekcie. Opis i komentarze zostają za
        // predykatem, bo idą innymi endpointami.
        var outgoing = await LinkQuery(issueUuid, isOutgoing: true)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var incoming = await LinkQuery(issueUuid, isOutgoing: false)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var links = outgoing.Concat(incoming).OrderBy(l => l.OtherKey, StringComparer.Ordinal).ToList();

        return new IssueGraphDto(issueUuid, parent, children, links);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyDictionary<Guid, IReadOnlyList<Guid>>> GetAncestorsAsync(
        IReadOnlyCollection<Guid> issueUuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(issueUuids);

        if (issueUuids.Count == 0)
        {
            return new Dictionary<Guid, IReadOnlyList<Guid>>();
        }

        var seeds = issueUuids.ToArray();

        var rows = await _dbContext.Database
            .SqlQuery<GraphEdgeRow>(
                $"""
                 with recursive up as (
                     select i.uuid as seed_uuid, i.parent_uuid as reached_uuid, 1 as depth
                     from taskmgmt.issue i
                     where i.uuid = any({seeds}) and i.parent_uuid is not null
                     union all
                     select up.seed_uuid, p.parent_uuid, up.depth + 1
                     from up
                     join taskmgmt.issue p on p.uuid = up.reached_uuid
                     where p.parent_uuid is not null and up.depth < {MaxDepth}
                 )
                 select seed_uuid, reached_uuid from up
                 """)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return Group(rows);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyDictionary<Guid, IReadOnlyList<Guid>>> GetBlockingReachableAsync(
        IReadOnlyCollection<Guid> issueUuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(issueUuids);

        if (issueUuids.Count == 0)
        {
            return new Dictionary<Guid, IReadOnlyList<Guid>>();
        }

        var seeds = issueUuids.ToArray();
        var blocks = IssueLinkType.Blocks.ToString();

        var rows = await _dbContext.Database
            .SqlQuery<GraphEdgeRow>(
                $"""
                 with recursive fwd as (
                     select l.source_uuid as seed_uuid, l.target_uuid as reached_uuid, 1 as depth
                     from taskmgmt.issue_link l
                     where l.source_uuid = any({seeds}) and l.type = {blocks}
                     union all
                     select fwd.seed_uuid, l.target_uuid, fwd.depth + 1
                     from fwd
                     join taskmgmt.issue_link l on l.source_uuid = fwd.reached_uuid and l.type = {blocks}
                     where fwd.depth < {MaxDepth}
                 )
                 select distinct seed_uuid, reached_uuid from fwd
                 """)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return Group(rows);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<(Guid Uuid, int Level, Guid RootUuid)>> GetSubtreeAsync(
        IReadOnlyCollection<Guid> rootUuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(rootUuids);

        if (rootUuids.Count == 0)
        {
            return [];
        }

        var roots = rootUuids.ToArray();
        var userUuid = IssueVisibility.CurrentUser(_executionContext);

        // Poddrzewo liczy się BEZ predykatu widoczności, a wynik przecinamy z widocznymi
        // zgłoszeniami dopiero po stronie wywołującego. Filtrowanie w środku rekurencji ucinałoby
        // gałąź na pierwszym niewidocznym zgłoszeniu i chowało widoczne wnuki — a to wygląda
        // jak zgubione dane, nie jak działający predykat.
        var rows = await _dbContext.Database
            .SqlQuery<SubtreeRow>(
                $"""
                 with recursive down as (
                     select i.uuid as uuid, 0 as level, i.uuid as root_uuid
                     from taskmgmt.issue i
                     where i.uuid = any({roots})
                     union all
                     select c.uuid, down.level + 1, down.root_uuid
                     from down
                     join taskmgmt.issue c on c.parent_uuid = down.uuid
                     where down.level < {MaxDepth}
                 )
                 select uuid, level, root_uuid
                 from down
                 order by root_uuid, level, uuid
                 """)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var visible = await _dbContext.Issues
            .AsNoTracking()
            .VisibleTo(_dbContext, userUuid)
            .Where(i => rows.Select(r => r.Uuid).Contains(i.Uuid))
            .Select(i => i.Uuid)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var allowed = visible.ToHashSet();

        return [.. rows.Where(r => allowed.Contains(r.Uuid)).Select(r => (r.Uuid, r.Level, r.RootUuid))];
    }

    /// <inheritdoc />
    public async Task<IReadOnlyDictionary<Guid, IssueTypeCategory>> GetTypeCategoriesAsync(
        IReadOnlyCollection<Guid> issueUuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(issueUuids);

        if (issueUuids.Count == 0)
        {
            return new Dictionary<Guid, IssueTypeCategory>();
        }

        return await (
                from issue in _dbContext.Issues.AsNoTracking()
                where issueUuids.Contains(issue.Uuid)
                join type in _dbContext.IssueTypes.AsNoTracking() on issue.TypeUuid equals type.Uuid
                select new { issue.Uuid, type.Category })
            .ToDictionaryAsync(x => x.Uuid, x => x.Category, cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>Jedna krawędź w jedną stronę. Parametr <paramref name="isOutgoing"/> ustala
    /// zarówno stronę zapytania, jak i wartość flagi w wyniku — ta sama krawędź czyta się
    /// inaczej u źródła („blokuje") i u celu („blokowane przez").</summary>
    private IQueryable<IssueLinkDto> LinkQuery(Guid issueUuid, bool isOutgoing)
        => from link in _dbContext.IssueLinks.AsNoTracking()
           where isOutgoing ? link.SourceUuid == issueUuid : link.TargetUuid == issueUuid
           join other in _dbContext.Issues.AsNoTracking()
               on (isOutgoing ? link.TargetUuid : link.SourceUuid) equals other.Uuid
           join state in _dbContext.WorkflowStates.AsNoTracking() on other.StateUuid equals state.Uuid
           select new IssueLinkDto(
               link.Uuid,
               issueUuid,
               other.Uuid,
               link.Type,
               isOutgoing,
               other.Key,
               other.Title,
               other.StateUuid,
               state.NameKey,
               state.Category);

    /// <summary>
    /// Nagłówki zgłoszeń pasujących do predykatu, posortowane po kluczu.
    ///
    /// <para><b>Sortowanie musi być PRZED projekcją</b> — EF nie potrafi przetłumaczyć
    /// <c>OrderBy</c> po polu rekordu, który sam dopiero powstaje w <c>select</c>, i wywraca
    /// całe zapytanie w czasie działania.</para>
    /// </summary>
    private IQueryable<IssueChildDto> Headers(Expression<Func<Issue, bool>> predicate)
        => from issue in _dbContext.Issues.AsNoTracking().Where(predicate).OrderBy(i => i.Key)
           join state in _dbContext.WorkflowStates.AsNoTracking() on issue.StateUuid equals state.Uuid
           select new IssueChildDto(
               issue.Uuid,
               issue.Key,
               issue.Title,
               issue.StateUuid,
               state.NameKey,
               state.Category,
               issue.AssigneeUuid);

    private static Dictionary<Guid, IReadOnlyList<Guid>> Group(IReadOnlyList<GraphEdgeRow> rows)
        => rows
            .GroupBy(r => r.SeedUuid)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Guid>)[.. g.Select(r => r.ReachedUuid).Distinct()]);
}
