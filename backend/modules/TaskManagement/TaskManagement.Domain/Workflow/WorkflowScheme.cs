using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Workflow;

/// <summary>
/// Automat stanów jako <b>dana, nie klasa</b> — nowy projekt z własnym zestawem stanów nie
/// wymaga wdrożenia kodu (patrz <c>docs/backend/task-management.md</c> §5).
///
/// <para>Świadoma różnica wobec DMS: zgłoszenia czytają <b>bieżący</b> schemat, nie snapshot.
/// Tablica pokazuje kilkaset zgłoszeń w kolumnach wyprowadzonych ze stanów — gdyby połowa kart
/// żyła na starej wersji schematu, trzeba by renderować kolumny, których w konfiguracji już
/// nie ma (§5.3).</para>
/// </summary>
public sealed class WorkflowScheme : AggregateRoot
{
    private readonly List<WorkflowState> _states = [];
    private readonly List<WorkflowTransition> _transitions = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private WorkflowScheme()
    {
    }

    private WorkflowScheme(Guid uuid, string name, bool isSystem) : base(uuid)
    {
        Name = name;
        IsSystem = isSystem;
    }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Schemat systemowy — zasilany seedem, nieusuwalny z UI.</summary>
    public bool IsSystem { get; private set; }

    public IReadOnlyList<WorkflowState> States => _states.AsReadOnly();

    public IReadOnlyList<WorkflowTransition> Transitions => _transitions.AsReadOnly();

    public static WorkflowScheme CreateWithUuid(Guid uuid, string name, bool isSystem)
        => new(uuid, ValidateName(name), isSystem);

    public WorkflowState AddState(
        Guid uuid,
        string code,
        string nameKey,
        WorkflowStateCategory category,
        int orderNo)
    {
        if (_states.Exists(s => string.Equals(s.Code, code, StringComparison.OrdinalIgnoreCase)))
        {
            throw new DomainException(
                "taskmgmt.workflow_state_duplicate",
                $"Stan `{code}` już istnieje w schemacie.");
        }

        var state = WorkflowState.Create(uuid, code, nameKey, category, orderNo);
        _states.Add(state);
        return state;
    }

    public WorkflowTransition AddTransition(
        Guid uuid,
        Guid fromStateUuid,
        Guid toStateUuid,
        string nameKey,
        string? requiredPermission = null,
        IEnumerable<string>? requiredFields = null)
    {
        if (!_states.Exists(s => s.Uuid == fromStateUuid) || !_states.Exists(s => s.Uuid == toStateUuid))
        {
            throw new DomainException(
                "taskmgmt.workflow_transition_unknown_state",
                "Przejście musi łączyć stany należące do tego samego schematu.");
        }

        var transition = WorkflowTransition.Create(uuid, fromStateUuid, toStateUuid, nameKey, requiredPermission, requiredFields);
        _transitions.Add(transition);
        return transition;
    }

    /// <summary>Nadpisuje szczegóły stanu — nazwę, kategorię i kolejność (WF-007). Kod pozostaje
    /// niezmienny, tak samo jak kod typu zgłoszenia (<see cref="IssueTypes.IssueTypeScheme.SetType"/>).</summary>
    public void SetState(Guid stateUuid, string nameKey, WorkflowStateCategory category, int orderNo)
        => FindStateOrThrow(stateUuid).SetDetails(nameKey, category, orderNo);

    /// <summary>
    /// Usuwa stan ze schematu.
    ///
    /// <para><b>Nie sprawdza zgłoszenia siedzące w tym stanie</b> — agregat nie widzi poza swoją
    /// granicę, tak samo jak <see cref="IssueTypes.IssueTypeScheme.RemoveType"/>. Blokadę usunięcia
    /// stanu, w którym są otwarte zgłoszenia, egzekwuje handler przez sondę użycia; jeśli sonda
    /// znajdzie zgłoszenia, każe skorzystać z <see cref="Publish"/> zamiast tej metody (WF-006).</para>
    ///
    /// <para>Odrzuca, gdy stan jest końcem albo początkiem jakiegokolwiek przejścia — inaczej
    /// macierz „z → do" zostałaby z krawędzią wiszącą w powietrzu.</para>
    /// </summary>
    public void RemoveState(Guid stateUuid)
    {
        var state = FindStateOrThrow(stateUuid);

        if (_transitions.Exists(t => t.FromStateUuid == stateUuid || t.ToStateUuid == stateUuid))
        {
            throw new DomainException(
                "taskmgmt.workflow_state_referenced_by_transition",
                $"Stan `{state.Code}` jest użyty w co najmniej jednym przejściu — usuń najpierw powiązane przejścia.");
        }

        _states.Remove(state);
    }

    /// <summary>Nadpisuje szczegóły przejścia — nazwę, uprawnienie i pola wymagane (WF-007).</summary>
    public void SetTransition(
        Guid transitionUuid,
        string nameKey,
        string? requiredPermission,
        IEnumerable<string>? requiredFields)
        => FindTransitionOrThrow(transitionUuid).SetDetails(nameKey, requiredPermission, requiredFields);

    /// <summary>Usuwa przejście ze schematu. Nie ma tu żadnej reguły chroniącej — usunięcie
    /// krawędzi jest zawsze bezpieczne dla samego schematu (w przeciwieństwie do usunięcia stanu),
    /// zgłoszenia znajdujące się akurat w stanie źródłowym po prostu tracą tę jedną ścieżkę.</summary>
    public void RemoveTransition(Guid transitionUuid)
        => _transitions.Remove(FindTransitionOrThrow(transitionUuid));

    /// <summary>
    /// Publikuje usunięcie stanów, które mają otwarte zgłoszenia (WF-006).
    ///
    /// <para>W odróżnieniu od <see cref="RemoveState"/> — który nie wie nic o zgłoszeniach —
    /// ta metoda jest wywoływana właśnie wtedy, gdy handler stwierdził, że usuwane stany MAJĄ
    /// zgłoszenia, więc migracja musi przejść przez zadanie masowe (<c>job</c>/<c>job_item</c>,
    /// WF-006 AC3). Agregat nadal nie zna zgłoszeń — jego rolą jest wyłącznie zagwarantować,
    /// że mapowanie jest kompletne i spójne, ZANIM handler założy zadanie migrujące choćby jedno
    /// zgłoszenie (WF-006 AC2: „publikacja bez pełnego mapowania jest odrzucana walidacją,
    /// nie kończy się osieroceniem”).</para>
    /// </summary>
    /// <param name="statesToRemove">Stany wskazane do usunięcia — muszą istnieć w tym schemacie.</param>
    /// <param name="mapping">Mapowanie usuwany stan → stan docelowy dla jego zgłoszeń. Musi mieć
    /// dokładnie jeden wpis na każdy stan z <paramref name="statesToRemove"/> — mniej niż to jest
    /// odrzucane jako niepełne mapowanie (AC2), więcej niż to jest odrzucane jako niespójne.</param>
    /// <returns>Pary (usuwany stan, stan docelowy) — gotowe dla handlera do zbudowania
    /// zadania masowego migrującego zgłoszenia.</returns>
    public IReadOnlyList<(Guid RemovedStateUuid, Guid TargetStateUuid)> Publish(
        IReadOnlyList<Guid> statesToRemove,
        IReadOnlyDictionary<Guid, Guid> mapping)
    {
        ArgumentNullException.ThrowIfNull(statesToRemove);
        ArgumentNullException.ThrowIfNull(mapping);

        if (statesToRemove.Count == 0)
        {
            throw new DomainException(
                "taskmgmt.workflow_publish_empty",
                "Publikacja musi obejmować co najmniej jeden usuwany stan.");
        }

        var removeSet = statesToRemove.ToHashSet();

        foreach (var stateUuid in removeSet)
        {
            FindStateOrThrow(stateUuid);
        }

        // AC2 — mapowanie musi pokrywać DOKŁADNIE zbiór usuwanych stanów: mniej niż to jest
        // niepełnym mapowaniem (zgłoszenia zostałyby osierocone), więcej niż to sugeruje żądanie
        // niespójne z tym, co użytkownik faktycznie zaznaczył do usunięcia.
        if (mapping.Count != removeSet.Count || mapping.Keys.Any(k => !removeSet.Contains(k)))
        {
            throw new DomainException(
                "taskmgmt.workflow_publish_mapping_incomplete",
                "Mapowanie migracji musi wskazywać stan docelowy dla każdego usuwanego stanu, i tylko dla nich.");
        }

        var result = new List<(Guid, Guid)>(mapping.Count);

        foreach (var (removedStateUuid, targetStateUuid) in mapping)
        {
            if (removeSet.Contains(targetStateUuid))
            {
                throw new DomainException(
                    "taskmgmt.workflow_publish_target_also_removed",
                    $"Stan docelowy {targetStateUuid} jest sam wśród usuwanych stanów — wskaż stan, który przetrwa publikację.");
            }

            FindStateOrThrow(targetStateUuid);
            result.Add((removedStateUuid, targetStateUuid));
        }

        // Walidacja PRZED mutacją (`docs/backend/cqrs.md` §3): sprawdzamy skutek usunięcia na
        // policzonym zbiorze, zanim cokolwiek zniknie z `_states`/`_transitions`.
        if (!_states.Exists(s => s.Category == WorkflowStateCategory.Todo && !removeSet.Contains(s.Uuid)))
        {
            throw new DomainException(
                "taskmgmt.workflow_publish_removes_initial_state",
                $"Publikacja usunęłaby ostatni stan kategorii Todo ze schematu `{Name}` — nowe zgłoszenia nie miałyby gdzie powstać.");
        }

        // Usuń stany i wszystkie przejścia je dotykające — macierz „z → do" musi zostać spójna
        // po publikacji, tak samo jak przy pojedynczym `RemoveState`.
        _transitions.RemoveAll(t => removeSet.Contains(t.FromStateUuid) || removeSet.Contains(t.ToStateUuid));
        _states.RemoveAll(s => removeSet.Contains(s.Uuid));

        return result;
    }

    /// <summary>Stan początkowy nowego zgłoszenia — pierwszy w kolejności z kategorii <c>Todo</c>.</summary>
    public WorkflowState InitialState()
        => _states
            .Where(s => s.Category == WorkflowStateCategory.Todo)
            .OrderBy(s => s.OrderNo)
            .FirstOrDefault()
            ?? throw new DomainException(
                "taskmgmt.workflow_scheme_without_initial_state",
                $"Schemat `{Name}` nie ma żadnego stanu w kategorii Todo.");

    /// <summary>
    /// Czy przejście jest opisane w schemacie. Przejście „w to samo miejsce” jest dozwolone
    /// jako operacja pusta — inaczej ponowione żądanie klienta (ten sam <c>X-Request-Id</c>,
    /// inna instancja) kończy się błędem zamiast niczym.
    /// </summary>
    public bool AllowsTransition(Guid fromStateUuid, Guid toStateUuid)
        => fromStateUuid == toStateUuid
           || _transitions.Exists(t => t.FromStateUuid == fromStateUuid && t.ToStateUuid == toStateUuid);

    public bool HasState(Guid stateUuid) => _states.Exists(s => s.Uuid == stateUuid);

    /// <summary>Znajduje opis przejścia między dwoma stanami — <c>null</c> dla przejście „w to
    /// samo miejsce” (dozwolone jako operacja pusta, patrz <see cref="AllowsTransition"/>, ale
    /// nieopisane żadnym wpisem, więc nie niesie <c>RequiredFields</c>).</summary>
    public WorkflowTransition? FindTransition(Guid fromStateUuid, Guid toStateUuid)
        => _transitions.Find(t => t.FromStateUuid == fromStateUuid && t.ToStateUuid == toStateUuid);

    public WorkflowState? FindStateByUuid(Guid stateUuid) => _states.Find(s => s.Uuid == stateUuid);

    public WorkflowTransition? FindTransitionByUuid(Guid transitionUuid) => _transitions.Find(t => t.Uuid == transitionUuid);

    private WorkflowState FindStateOrThrow(Guid stateUuid)
        => FindStateByUuid(stateUuid)
            ?? throw new DomainException(
                "taskmgmt.workflow_state_not_found",
                $"Stan {stateUuid} nie należy do schematu `{Name}`.");

    private WorkflowTransition FindTransitionOrThrow(Guid transitionUuid)
        => FindTransitionByUuid(transitionUuid)
            ?? throw new DomainException(
                "taskmgmt.workflow_transition_not_found",
                $"Przejście {transitionUuid} nie należy do schematu `{Name}`.");

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.workflow_scheme_name_empty", "Nazwa schematu nie może być pusta.");
        }

        return name.Trim();
    }
}
