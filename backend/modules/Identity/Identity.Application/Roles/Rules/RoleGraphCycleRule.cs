using Erp.BuildingBlocks.Validation;

namespace Identity.Application.Roles;

/// <summary>Krawędź do dodania: <see cref="ContainerUuid"/> ma przyjąć <see cref="MemberUuid"/>
/// jako składową.</summary>
public sealed record RoleMemberTarget(Guid ContainerUuid, Guid MemberUuid);

/// <summary>
/// Reguła wsadowa: dodanie krawędzi kontener→składowa nie może zamknąć cyklu ani stworzyć
/// samo-zawierania.
///
/// <para><b>Dlaczego to NIE jest to samo sprawdzenie co <c>IRoleQueries.IsDescendantAsync</c>.</b>
/// Ta metoda pyta bazę o stan ZACOMMITOWANY — nie widzi krawędzi z wcześniejszych elementów
/// TEGO SAMEGO wsadu, bo <c>BulkCommandRunner</c> zatwierdza je dopiero razem z całym chunkiem.
/// Para <c>A→B</c> i <c>B→A</c> w jednym zadaniu przeszłaby więc <c>IsDescendantAsync</c> oba
/// razy (żadna krawędź jeszcze nie istnieje w bazie w chwili pre-checku) i zamknęłaby cykl.
/// <c>RoleAddMemberCommandHandler</c> nadal woła <c>IsDescendantAsync</c> jako DRUGĄ linię
/// obrony — łapie cykle względem wcześniej zacommitowanych zadań, nie względem tego samego
/// wsadu (patrz <c>docs/guides/backend/batch-validation.md</c>).</para>
///
/// <para><b>Algorytm.</b> Jedno zapytanie ładuje CAŁY graf <c>role_member</c>
/// (<see cref="IRoleQueries.GetAllMembershipEdgesAsync"/>) do pamięci. Elementy wsadu idą
/// w kolejności listy (czyli <c>Ordinal</c> zadania — patrz <c>BatchEndpointBase</c>): dla
/// każdej kandydującej krawędzi sprawdzamy, czy <c>MemberUuid</c> już (transitywnie) zawiera
/// <c>ContainerUuid</c> — jeśli tak, dodanie zamknęłoby cykl. Krawędzie ZAAKCEPTOWANE wchodzą
/// do symulowanego grafu, więc kolejne elementy tego samego wsadu je widzą.</para>
/// </summary>
public sealed class RoleGraphCycleRule : IBatchRule<RoleMemberTarget>
{
    private readonly IRoleQueries _queries;

    public RoleGraphCycleRule(IRoleQueries queries)
    {
        _queries = queries;
    }

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<RoleMemberTarget> items,
        Func<RoleMemberTarget, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(tracker);

        if (items.Count == 0)
        {
            return;
        }

        var edges = await _queries.GetAllMembershipEdgesAsync(cancellationToken).ConfigureAwait(false);

        var graph = new Dictionary<Guid, List<Guid>>();
        foreach (var edge in edges)
        {
            AddEdge(graph, edge.ContainerUuid, edge.MemberUuid);
        }

        foreach (var item in items)
        {
            var uuid = idSelector(item);

            if (item.ContainerUuid == item.MemberUuid)
            {
                tracker.AddError(uuid, "role_self_membership", "Rola nie może zawierać samej siebie.");
                continue;
            }

            // Czy MemberUuid już (transitywnie, licząc krawędzie zaakceptowane wcześniej
            // w TYM wsadzie) zawiera ContainerUuid? Jeśli tak, nowa krawędź Container→Member
            // zamknęłaby pętlę.
            if (IsReachable(graph, item.MemberUuid, item.ContainerUuid))
            {
                tracker.AddError(
                    uuid,
                    "role_cycle_detected",
                    $"Dodanie roli {item.MemberUuid} do {item.ContainerUuid} utworzyłoby cykl.");
                continue;
            }

            AddEdge(graph, item.ContainerUuid, item.MemberUuid);
        }
    }

    private static void AddEdge(Dictionary<Guid, List<Guid>> graph, Guid container, Guid member)
    {
        if (!graph.TryGetValue(container, out var members))
        {
            members = [];
            graph[container] = members;
        }

        members.Add(member);
    }

    /// <summary>DFS: czy istnieje ścieżka <paramref name="from"/> → ... → <paramref name="to"/>
    /// idąc krawędziami kontener→składowa.</summary>
    private static bool IsReachable(Dictionary<Guid, List<Guid>> graph, Guid from, Guid to)
    {
        var visited = new HashSet<Guid> { from };
        var stack = new Stack<Guid>();
        stack.Push(from);

        while (stack.Count > 0)
        {
            var current = stack.Pop();

            if (current == to)
            {
                return true;
            }

            if (!graph.TryGetValue(current, out var members))
            {
                continue;
            }

            foreach (var member in members)
            {
                if (visited.Add(member))
                {
                    stack.Push(member);
                }
            }
        }

        return false;
    }
}
