namespace Identity.Domain.Users;

/// <summary>
/// Nadanie roli użytkownikowi — nie sam <c>Guid</c>, bo audyt („kto, kiedy, dlaczego")
/// i wygasające nadania (Faza 6) potrzebują metadanych, których gołe id ról nie uniesie.
/// Mapowane jako encja własna (owned) w tabeli <c>user_role</c> — patrz
/// <c>UserAccountConfiguration</c>.
/// </summary>
public sealed class UserRoleGrant
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private UserRoleGrant()
    {
    }

    private UserRoleGrant(Guid roleUuid, DateTimeOffset grantedAt, string? grantedBy, DateTimeOffset? expiresAt)
    {
        RoleUuid = roleUuid;
        GrantedAt = grantedAt;
        GrantedBy = grantedBy;
        ExpiresAt = expiresAt;
    }

    public Guid RoleUuid { get; private set; }

    public DateTimeOffset GrantedAt { get; private set; }

    /// <summary><c>sub</c> użytkownika, który nadał rolę — <c>null</c> dla nadań systemowych
    /// (np. rola <c>administrator</c> przy JIT provisioning pierwszego użytkownika).</summary>
    public string? GrantedBy { get; private set; }

    /// <summary><c>null</c> = nadanie bezterminowe.</summary>
    public DateTimeOffset? ExpiresAt { get; private set; }

    public bool IsActive(DateTimeOffset now) => ExpiresAt is null || ExpiresAt > now;

    public static UserRoleGrant Create(Guid roleUuid, DateTimeOffset grantedAt, string? grantedBy, DateTimeOffset? expiresAt)
        => new(roleUuid, grantedAt, grantedBy, expiresAt);
}
