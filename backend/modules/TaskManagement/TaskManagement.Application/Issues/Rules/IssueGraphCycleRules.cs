using Erp.BuildingBlocks.Validation;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Application.Issues;

/// <summary>Krawędź hierarchii do ustawienia: <see cref="IssueUuid"/> ma dostać rodzica
/// <see cref="ParentUuid"/>.</summary>
public sealed record IssueParentTarget(Guid IssueUuid, Guid? ParentUuid);

/// <summary>Krawędź powiązania do dodania.</summary>
public sealed record IssueLinkTarget(Guid SourceUuid, Guid TargetUuid, IssueLinkType Type);

/// <summary>
/// Reguła wsadowa: ustawienie rodzica nie może zamknąć pętli w drzewie
/// (<c>docs/backend/task-management.md</c> §8.2).
///
/// <para><b>Dlaczego to nie wystarcza samo sprawdzenie w handlerze.</b> Handler pyta bazę
/// o stan ZACOMMITOWANY — nie widzi krawędzi z wcześniejszych elementów TEGO SAMEGO wsadu,
/// bo <c>BulkCommandRunner</c> zatwierdza je dopiero razem z chunkiem. Para „A rodzicem B"
/// i „B rodzicem A" w jednym zadaniu przeszłaby więc oba sprawdzenia. Ta reguła symuluje
/// krawędzie zaakceptowane wcześniej w tym samym wsadzie, a handler zostaje drugą linią obrony
/// względem zadań zacommitowanych w międzyczasie — ten sam podział ról, co przy
/// <c>RoleGraphCycleRule</c> w Identity.</para>
///
/// <para><b>Różnica wobec Identity:</b> tam cały graf ról wczytuje się do pamięci, bo ról są
/// dziesiątki. Tutaj przodkowie przychodzą <b>rekurencyjnym CTE</b>, po jednym zapytaniu na
/// wsad — drzewo zgłoszeń w dużym projekcie ma tysiące wierzchołków i wczytywanie go w całości
/// przy każdej operacji masowej byłoby kosztem rosnącym z wiekiem projektu.</para>
/// </summary>
public sealed class IssueParentCycleRule : IBatchRule<IssueParentTarget>
{
    private readonly IIssueGraphQueries _graph;

    public IssueParentCycleRule(IIssueGraphQueries graph) => _graph = graph;

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<IssueParentTarget> items,
        Func<IssueParentTarget, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(idSelector);
        ArgumentNullException.ThrowIfNull(tracker);

        var candidates = items.Where(i => i.ParentUuid is { } p && p != Guid.Empty).ToList();

        if (candidates.Count == 0)
        {
            return;
        }

        var ancestors = await _graph
            .GetAncestorsAsync([.. candidates.Select(c => c.ParentUuid!.Value).Distinct()], cancellationToken)
            .ConfigureAwait(false);

        // Krawędzie zaakceptowane w tym wsadzie: dziecko → nowy rodzic. Kolejne elementy muszą
        // je widzieć, inaczej wsad zamknie pętlę sam ze sobą.
        var pending = new Dictionary<Guid, Guid>();

        foreach (var item in candidates)
        {
            var uuid = idSelector(item);
            var parentUuid = item.ParentUuid!.Value;

            if (parentUuid == item.IssueUuid)
            {
                tracker.AddError(uuid, "taskmgmt.parent_self", "Zgłoszenie nie może być swoim własnym rodzicem.");
                continue;
            }

            if (Reaches(parentUuid, item.IssueUuid, ancestors, pending))
            {
                tracker.AddError(
                    uuid,
                    "taskmgmt.parent_cycle",
                    $"Zgłoszenie {parentUuid} leży w poddrzewie {item.IssueUuid} — taka hierarchia byłaby pętlą.");
                continue;
            }

            pending[item.IssueUuid] = parentUuid;
        }
    }

    /// <summary>Czy idąc w górę od <paramref name="from"/> trafimy na <paramref name="target"/>.
    /// Ścieżka biegnie po przodkach z bazy, a gdy się skończą — po krawędziach dołożonych
    /// w tym wsadzie.</summary>
    private static bool Reaches(
        Guid from,
        Guid target,
        IReadOnlyDictionary<Guid, IReadOnlyList<Guid>> ancestors,
        Dictionary<Guid, Guid> pending)
    {
        if (ancestors.TryGetValue(from, out var chain) && chain.Contains(target))
        {
            return true;
        }

        var visited = new HashSet<Guid>();
        var current = from;

        while (pending.TryGetValue(current, out var next) && visited.Add(current))
        {
            if (next == target)
            {
                return true;
            }

            if (ancestors.TryGetValue(next, out var nextChain) && nextChain.Contains(target))
            {
                return true;
            }

            current = next;
        }

        return false;
    }
}

/// <summary>
/// Reguła wsadowa: dodanie blokady nie może zamknąć pętli w grafie <c>blokuje</c> (§8.2).
///
/// <para>Sprawdzamy <b>wyłącznie</b> <see cref="IssueLinkType.Blocks"/>. Pozostałe typy opisują
/// relacje bez kierunku wykonania — „A dotyczy B" i „B dotyczy A" naraz jest nadmiarowe, ale
/// nie jest błędem i odrzucanie tego byłoby wrogie.</para>
/// </summary>
public sealed class IssueLinkCycleRule : IBatchRule<IssueLinkTarget>
{
    private readonly IIssueGraphQueries _graph;

    public IssueLinkCycleRule(IIssueGraphQueries graph) => _graph = graph;

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<IssueLinkTarget> items,
        Func<IssueLinkTarget, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(idSelector);
        ArgumentNullException.ThrowIfNull(tracker);

        var candidates = items.Where(i => i.Type == IssueLinkType.Blocks).ToList();

        if (candidates.Count == 0)
        {
            return;
        }

        var reachable = await _graph
            .GetBlockingReachableAsync([.. candidates.Select(c => c.TargetUuid).Distinct()], cancellationToken)
            .ConfigureAwait(false);

        var pending = new List<IssueLinkTarget>();

        foreach (var item in candidates)
        {
            var uuid = idSelector(item);

            if (item.SourceUuid == item.TargetUuid)
            {
                tracker.AddError(uuid, "taskmgmt.link_self", "Zgłoszenie nie może blokować samo siebie.");
                continue;
            }

            if (Reaches(item.TargetUuid, item.SourceUuid, reachable, pending))
            {
                tracker.AddError(
                    uuid,
                    "taskmgmt.link_cycle",
                    "Ta blokada zamknęłaby pętlę — cel (pośrednio) blokuje już źródło.");
                continue;
            }

            pending.Add(item);
        }
    }

    private static bool Reaches(
        Guid from,
        Guid target,
        IReadOnlyDictionary<Guid, IReadOnlyList<Guid>> reachable,
        IReadOnlyList<IssueLinkTarget> pending)
    {
        var visited = new HashSet<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(from);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();

            if (current == target)
            {
                return true;
            }

            if (!visited.Add(current))
            {
                continue;
            }

            if (reachable.TryGetValue(current, out var fromDb))
            {
                if (fromDb.Contains(target))
                {
                    return true;
                }

                foreach (var next in fromDb)
                {
                    queue.Enqueue(next);
                }
            }

            // Krawędzie z tego samego wsadu — baza ich jeszcze nie widzi.
            foreach (var edge in pending.Where(e => e.SourceUuid == current))
            {
                queue.Enqueue(edge.TargetUuid);
            }
        }

        return false;
    }
}
