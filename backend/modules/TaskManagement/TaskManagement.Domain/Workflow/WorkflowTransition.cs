using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Workflow;

/// <summary>
/// Jedno dozwolone przejście w schemacie. Przejście nieopisane tutaj <b>nie istnieje</b> —
/// zgłoszenie odrzuca je błędem <c>taskmgmt.transition_not_allowed</c>.
///
/// <para>Faza 0 niosła wyłącznie <see cref="RequiredPermission"/>; faza 4 dokłada
/// <see cref="RequiredFields"/> (WF-004) — lista kodów pól, które muszą mieć niepustą wartość
/// na zgłoszeniu, zanim przejście wykona się do końca. Front sprawdza to PRZED wysłaniem komendy
/// (modal zbierający brakujące pola), a agregat sprawdza to samo jako backstop — patrz
/// <see cref="Issues.Issue.SetState"/>. <c>guard</c> (warunek w tym samym wąskim języku,
/// co krawędzie gateway w DMS) zostaje poza zakresem WF-004 — patrz
/// <c>docs/modules/task-management/domain.md</c> §5.2.</para>
/// </summary>
public sealed class WorkflowTransition : Entity
{
    private readonly List<string> _requiredFields = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    private WorkflowTransition()
    {
    }

    private WorkflowTransition(
        Guid uuid,
        Guid fromStateUuid,
        Guid toStateUuid,
        string nameKey,
        string? requiredPermission,
        IEnumerable<string> requiredFields)
        : base(uuid)
    {
        FromStateUuid = fromStateUuid;
        ToStateUuid = toStateUuid;
        NameKey = nameKey;
        RequiredPermission = requiredPermission;
        _requiredFields.AddRange(requiredFields);
    }

    public Guid SchemeUuid { get; private set; }

    public Guid FromStateUuid { get; private set; }

    public Guid ToStateUuid { get; private set; }

    public string NameKey { get; private set; } = string.Empty;

    /// <summary>Kod uprawnienia wymagany do wykonania przejścia; <c>null</c> = wystarcza
    /// uprawnienie do edycji zgłoszenia.</summary>
    public string? RequiredPermission { get; private set; }

    /// <summary>Kody pól niestandardowych (<see cref="FieldSchemes.FieldDefinition.Code"/>),
    /// które muszą mieć niepustą wartość na zgłoszeniu, zanim to przejście wykona się do końca
    /// (WF-004). Pusta lista — domyślna — znaczy „bez dodatkowego wymogu”.</summary>
    public IReadOnlyList<string> RequiredFields => _requiredFields.AsReadOnly();

    internal static WorkflowTransition Create(
        Guid uuid,
        Guid fromStateUuid,
        Guid toStateUuid,
        string nameKey,
        string? requiredPermission,
        IEnumerable<string>? requiredFields = null)
        => new(uuid, fromStateUuid, toStateUuid, nameKey, requiredPermission, requiredFields ?? []);

    /// <summary>Nadpisuje szczegóły przejścia — nazwę, uprawnienie i pola wymagane (WF-007).
    /// <c>From</c>/<c>To</c> pozostają niezmienne: zmiana krawędzi to usunięcie starego
    /// przejścia i dodanie nowego, nie edycja istniejącego (ten sam powód, co przy kodzie stanu).</summary>
    internal void SetDetails(string nameKey, string? requiredPermission, IEnumerable<string>? requiredFields)
    {
        NameKey = nameKey;
        RequiredPermission = requiredPermission;
        _requiredFields.Clear();
        _requiredFields.AddRange(requiredFields ?? []);
    }
}
