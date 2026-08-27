using Erp.BuildingBlocks.Domain;

namespace TaskManagement.Domain.Workflow;

/// <summary>
/// Jedno dozwolone przejście w schemacie. Przejście nieopisane tutaj <b>nie istnieje</b> —
/// zgłoszenie odrzuca je błędem <c>taskmgmt.transition_not_allowed</c>.
///
/// <para>Faza 0 niesie wyłącznie <see cref="RequiredPermission"/>; <c>required_fields</c>
/// i <c>guard</c> (warunek w tym samym wąskim języku, co krawędzie gateway w DMS) dochodzą
/// w fazie 1 — patrz <c>docs/backend/task-management.md</c> §5.2.</para>
/// </summary>
public sealed class WorkflowTransition : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private WorkflowTransition()
    {
    }

    private WorkflowTransition(
        Guid uuid,
        Guid fromStateUuid,
        Guid toStateUuid,
        string nameKey,
        string? requiredPermission)
        : base(uuid)
    {
        FromStateUuid = fromStateUuid;
        ToStateUuid = toStateUuid;
        NameKey = nameKey;
        RequiredPermission = requiredPermission;
    }

    public Guid SchemeUuid { get; private set; }

    public Guid FromStateUuid { get; private set; }

    public Guid ToStateUuid { get; private set; }

    public string NameKey { get; private set; } = string.Empty;

    /// <summary>Kod uprawnienia wymagany do wykonania przejścia; <c>null</c> = wystarcza
    /// uprawnienie do edycji zgłoszenia.</summary>
    public string? RequiredPermission { get; private set; }

    internal static WorkflowTransition Create(
        Guid uuid,
        Guid fromStateUuid,
        Guid toStateUuid,
        string nameKey,
        string? requiredPermission)
        => new(uuid, fromStateUuid, toStateUuid, nameKey, requiredPermission);
}
