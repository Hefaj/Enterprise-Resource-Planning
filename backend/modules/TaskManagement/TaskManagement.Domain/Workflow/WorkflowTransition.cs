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
    private readonly List<string> _requiredFieldCodes = [];

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
        IEnumerable<string>? requiredFieldCodes)
        : base(uuid)
    {
        FromStateUuid = fromStateUuid;
        ToStateUuid = toStateUuid;
        NameKey = nameKey;
        RequiredPermission = requiredPermission;
        _requiredFieldCodes.AddRange(NormalizeRequiredFieldCodes(requiredFieldCodes));
    }

    public Guid SchemeUuid { get; private set; }

    public Guid FromStateUuid { get; private set; }

    public Guid ToStateUuid { get; private set; }

    public string NameKey { get; private set; } = string.Empty;

    /// <summary>Kod uprawnienia wymagany do wykonania przejścia; <c>null</c> = wystarcza
    /// uprawnienie do edycji zgłoszenia.</summary>
    public string? RequiredPermission { get; private set; }

    /// <summary>
    /// Kody pól, które muszą mieć wartość zanim użytkownik wykona tę krawędź. To konfiguracja
    /// krawędzi, a nie właściwość pola: np. numer protokołu może być opcjonalny w szkicu,
    /// lecz obowiązkowy przy przekazaniu do odbioru.
    /// </summary>
    public IReadOnlyList<string> RequiredFieldCodes => _requiredFieldCodes.AsReadOnly();

    internal static WorkflowTransition Create(
        Guid uuid,
        Guid fromStateUuid,
        Guid toStateUuid,
        string nameKey,
        string? requiredPermission,
        IEnumerable<string>? requiredFieldCodes = null)
        => new(uuid, fromStateUuid, toStateUuid, nameKey, requiredPermission, requiredFieldCodes);

    private static IEnumerable<string> NormalizeRequiredFieldCodes(IEnumerable<string>? codes)
        => (codes ?? [])
            .Where(code => !string.IsNullOrWhiteSpace(code))
            .Select(code => code.Trim())
            .Distinct(StringComparer.Ordinal)
            .OrderBy(code => code, StringComparer.Ordinal);
}
