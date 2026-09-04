namespace Identity.Domain.Users;

/// <summary>
/// Uprawnienie nadane bezpośrednio użytkownikowi, z pominięciem ról — wyjątek z powodem,
/// nie równoprawna ścieżka (patrz <c>docs/architecture/security.md</c> §1, punkt 4).
/// <see cref="Reason"/> jest wymagany: bezpośrednie nadanie bez ról jest niestandardowe
/// z założenia, więc musi zostawić ślad "dlaczego", żeby ktoś za pół roku nie musiał zgadywać.
/// </summary>
public sealed class UserPermissionGrant
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private UserPermissionGrant()
    {
    }

    private UserPermissionGrant(string permissionCode, DateTimeOffset grantedAt, string? grantedBy, string reason)
    {
        PermissionCode = permissionCode;
        GrantedAt = grantedAt;
        GrantedBy = grantedBy;
        Reason = reason;
    }

    public string PermissionCode { get; private set; } = string.Empty;

    public DateTimeOffset GrantedAt { get; private set; }

    public string? GrantedBy { get; private set; }

    public string Reason { get; private set; } = string.Empty;

    public static UserPermissionGrant Create(
        string permissionCode, DateTimeOffset grantedAt, string? grantedBy, string reason)
        => new(permissionCode, grantedAt, grantedBy, reason);
}
