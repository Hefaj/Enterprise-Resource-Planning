using Erp.BuildingBlocks.Domain;

namespace Identity.Domain.Users;

/// <summary>
/// Projekcja użytkownika Keycloaka w domenie ERP. Identity NIE trzyma hasła ani żadnego
/// sekretu uwierzytelniającego — to zadanie Keycloaka (patrz
/// <c>docs/backend/identity-authz.md</c> §1). Ten agregat istnieje wyłącznie po to, żeby
/// przypiąć role i uprawnienia bezpośrednie do <see cref="Uuid"/>, które JEST claimem
/// <c>sub</c> tokenu JWT — nie osobnym, wewnętrznym identyfikatorem.
///
/// <para><b>Provisioning JIT.</b> Wiersz powstaje przy pierwszym uwierzytelnionym żądaniu
/// danego użytkownika (patrz <c>Identity.Api</c> — middleware provisioningu), nie przez
/// rejestrację — Keycloak jest jedynym miejscem zakładania kont.</para>
/// </summary>
public class UserAccount : AggregateRoot
{
    private readonly List<UserRoleGrant> _roleGrants = [];
    private readonly List<UserPermissionGrant> _permissionGrants = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    protected UserAccount()
    {
    }

    private UserAccount(
        Guid uuid, string email, string displayName, DateTimeOffset syncedAt,
        UserAccountKind kind = UserAccountKind.Human, string? description = null) : base(uuid)
    {
        Email = email;
        DisplayName = displayName;
        IsActive = true;
        SyncedAt = syncedAt;
        Kind = kind;
        Description = description;
    }

    public string Email { get; private set; } = string.Empty;

    public string DisplayName { get; private set; } = string.Empty;

    /// <summary>Human (JIT z Keycloaka) czy Service (klucz integracyjny, patrz
    /// <see cref="CreateServiceAccount"/>) — patrz <see cref="UserAccountKind"/>.</summary>
    public UserAccountKind Kind { get; private set; } = UserAccountKind.Human;

    /// <summary>Po co istnieje ten klucz integracyjny — puste dla kont ludzkich.</summary>
    public string? Description { get; private set; }

    /// <summary>Dezaktywacja tu jest lokalną blokadą po stronie Identity — właściwe wyłączenie
    /// konta (i unieważnienie sesji) dzieje się w Keycloaku; to pole pozwala odciąć uprawnienia
    /// natychmiast, zanim propagacja do Keycloaka się dokona.</summary>
    public bool IsActive { get; private set; }

    /// <summary>Kiedy ostatnio zaktualizowano projekcję z claimów tokenu (e-mail, nazwa).</summary>
    public DateTimeOffset SyncedAt { get; private set; }

    public IReadOnlyList<UserRoleGrant> RoleGrants => _roleGrants.AsReadOnly();

    public IReadOnlyList<UserPermissionGrant> PermissionGrants => _permissionGrants.AsReadOnly();

    /// <summary>Zakłada projekcję przy pierwszym uwierzytelnionym żądaniu — <paramref name="uuid"/>
    /// to <c>sub</c> tokenu, nie generowany lokalnie identyfikator.</summary>
    public static UserAccount ProvisionFromToken(Guid uuid, string email, string displayName, DateTimeOffset now)
        => new(uuid, ValidateEmail(email), ValidateDisplayName(displayName), now);

    /// <summary>Zakłada konto serwisowe dla poufnego klienta Keycloaka z <c>client_credentials</c>
    /// — <paramref name="uuid"/> to <c>sub</c> jego service-accounta, wklejony przez administratora
    /// (nie losowy, ale wciąż identyfikator zakładanego agregatu — ten sam kształt kontraktu co
    /// przy innych Create z generowanym uuid). E-mail jest syntetycznym, unikalnym placeholderem —
    /// istniejący unikalny indeks na <see cref="Email"/> i <see cref="ValidateEmail"/> nie
    /// wymagają od admina wymyślania fałszywego adresu.</summary>
    public static UserAccount CreateServiceAccount(Guid uuid, string name, string? description, DateTimeOffset now)
        => new(
            uuid,
            $"integration+{uuid:N}@erp.local",
            ValidateDisplayName(name),
            now,
            UserAccountKind.Service,
            description);

    /// <summary>Odświeża projekcję claimów przy kolejnym logowaniu — e-mail/nazwa w Keycloaku
    /// mogły się zmienić od ostatniej wizyty.</summary>
    public void SyncFromToken(string email, string displayName, DateTimeOffset now)
    {
        Email = ValidateEmail(email);
        DisplayName = ValidateDisplayName(displayName);
        SyncedAt = now;
    }

    public void AddRole(Guid roleUuid, DateTimeOffset now, string? grantedBy, DateTimeOffset? expiresAt)
    {
        if (_roleGrants.Any(g => g.RoleUuid == roleUuid))
        {
            return;
        }

        _roleGrants.Add(UserRoleGrant.Create(roleUuid, now, grantedBy, expiresAt));
    }

    public void RemoveRole(Guid roleUuid) => _roleGrants.RemoveAll(g => g.RoleUuid == roleUuid);

    public void AddPermission(string permissionCode, DateTimeOffset now, string? grantedBy, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainException(
                "user_permission_reason_required",
                "Bezpośrednie nadanie uprawnienia użytkownikowi wymaga podania powodu.");
        }

        if (_permissionGrants.Any(g => string.Equals(g.PermissionCode, permissionCode, StringComparison.Ordinal)))
        {
            return;
        }

        _permissionGrants.Add(UserPermissionGrant.Create(permissionCode, now, grantedBy, reason));
    }

    public void RemovePermission(string permissionCode)
        => _permissionGrants.RemoveAll(g => string.Equals(g.PermissionCode, permissionCode, StringComparison.Ordinal));

    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;

    private static string ValidateEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@', StringComparison.Ordinal))
        {
            throw new DomainException("user_email_invalid", "Adres e-mail użytkownika jest nieprawidłowy.");
        }

        return email.Trim();
    }

    private static string ValidateDisplayName(string displayName)
        => string.IsNullOrWhiteSpace(displayName) ? string.Empty : displayName.Trim();
}
