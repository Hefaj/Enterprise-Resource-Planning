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
        string? requiredPermission = null)
    {
        if (!_states.Exists(s => s.Uuid == fromStateUuid) || !_states.Exists(s => s.Uuid == toStateUuid))
        {
            throw new DomainException(
                "taskmgmt.workflow_transition_unknown_state",
                "Przejście musi łączyć stany należące do tego samego schematu.");
        }

        var transition = WorkflowTransition.Create(uuid, fromStateUuid, toStateUuid, nameKey, requiredPermission);
        _transitions.Add(transition);
        return transition;
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

    /// <summary>Stan schematu po UUID; używany przez agregat Issue do utrzymania trwałej
    /// kategorii stanu dla indeksów zapytań operacyjnych.</summary>
    public WorkflowState State(Guid stateUuid)
        => _states.First(state => state.Uuid == stateUuid);

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("taskmgmt.workflow_scheme_name_empty", "Nazwa schematu nie może być pusta.");
        }

        return name.Trim();
    }
}
