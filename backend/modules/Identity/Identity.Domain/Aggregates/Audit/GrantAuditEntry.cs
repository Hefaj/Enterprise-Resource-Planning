using Erp.BuildingBlocks.Domain;

namespace Identity.Domain.Audit;

/// <summary>
/// Wpis dziennika audytowego nadań/odebrań — kto (<see cref="ActorUserUuid"/>) zrobił co
/// (<see cref="Action"/>) komu (<see cref="SubjectType"/>/<see cref="SubjectUuid"/>) i dlaczego
/// (<see cref="Reason"/>), patrz <c>docs/architecture/security.md</c> Faza 6.
///
/// <para><b>Append-only, bez FK do <c>role</c>/<c>user_account</c>.</b> Wpis musi przeżyć
/// usunięcie roli albo dezaktywację użytkownika — audyt „kto nadał uprawnienie X" jest
/// wartościowy nawet długo po tym, jak nadanie zniknęło. Dlatego to zwykła encja (nie
/// <see cref="AggregateRoot"/>) bez tokenu współbieżności <c>xmin</c> — nikt nigdy nie
/// modyfikuje istniejącego wiersza, tylko dopisuje nowe.</para>
/// </summary>
public sealed class GrantAuditEntry : Entity
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private GrantAuditEntry()
    {
    }

    private GrantAuditEntry(
        Guid uuid,
        DateTimeOffset occurredAt,
        Guid actorUserUuid,
        string subjectType,
        Guid subjectUuid,
        string action,
        string targetCode,
        string? reason,
        string source)
        : base(uuid)
    {
        OccurredAt = occurredAt;
        ActorUserUuid = actorUserUuid;
        SubjectType = subjectType;
        SubjectUuid = subjectUuid;
        Action = action;
        TargetCode = targetCode;
        Reason = reason;
        Source = source;
    }

    public DateTimeOffset OccurredAt { get; private set; }

    /// <summary><c>sub</c> użytkownika, który wykonał akcję. <see cref="Guid.Empty"/> dla akcji
    /// systemowych bez ludzkiego sprawcy (np. wygaśnięcie nadania przez zadanie w tle).</summary>
    public Guid ActorUserUuid { get; private set; }

    /// <summary><c>"user"</c> albo <c>"role"</c> — czego dotyczy akcja.</summary>
    public string SubjectType { get; private set; } = string.Empty;

    public Guid SubjectUuid { get; private set; }

    /// <summary>Jedna z: <c>role_assigned</c>, <c>role_revoked</c>, <c>permission_granted</c>,
    /// <c>permission_revoked</c>, <c>role_member_added</c>, <c>role_member_removed</c>,
    /// <c>role_permission_added</c>, <c>role_permission_removed</c>, <c>role_grant_expired</c>,
    /// <c>user_forced_logout</c>.</summary>
    public string Action { get; private set; } = string.Empty;

    /// <summary>Kod uprawnienia albo identyfikator roli, zależnie od <see cref="Action"/> —
    /// zawsze tekst, żeby jeden wiersz obsłużył oba przypadki bez dwóch nullable kolumn.</summary>
    public string TargetCode { get; private set; } = string.Empty;

    public string? Reason { get; private set; }

    /// <summary><c>"identity.api"</c> albo <c>"cleanup-job"</c> — skąd wpis pochodzi.</summary>
    public string Source { get; private set; } = string.Empty;

    public static GrantAuditEntry Create(
        DateTimeOffset occurredAt,
        Guid actorUserUuid,
        string subjectType,
        Guid subjectUuid,
        string action,
        string targetCode,
        string? reason,
        string source)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(subjectType);
        ArgumentException.ThrowIfNullOrWhiteSpace(action);
        ArgumentException.ThrowIfNullOrWhiteSpace(targetCode);
        ArgumentException.ThrowIfNullOrWhiteSpace(source);

        return new(NewUuid(), occurredAt, actorUserUuid, subjectType, subjectUuid, action, targetCode, reason, source);
    }
}
