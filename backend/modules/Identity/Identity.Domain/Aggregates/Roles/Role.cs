using Erp.BuildingBlocks.Domain;

namespace Identity.Domain.Roles;

/// <summary>
/// Rola — "grupa uprawnień" z pytania, które zapoczątkowało ten moduł (patrz
/// <c>docs/architecture/security.md</c> §1-2). Niesie zbiór uprawnień bezpośrednich
/// (<see cref="Permissions"/>) i zbiór ról składowych (<see cref="MemberRoleUuids"/>), których
/// uprawnienia dziedziczy — hierarchiczne RBAC (NIST RBAC1).
///
/// <para><b>Kierunek dziedziczenia.</b> "Ta rola (kontener) zawiera rolę X (składową) i przejmuje
/// jej uprawnienia" — nazwy <c>container</c>/<c>member</c> są celowe, nie <c>parent</c>/<c>child</c>,
/// bo ta para regularnie prowadzi do odwrócenia semantyki przy odczycie kodu.</para>
///
/// <para><b>To jest DAG, nie drzewo</b> — rola może być składową wielu kontenerów. Walidacja
/// cyklu wymaga zapytania do bazy (czy kandydat jest już przodkiem kontenera), więc NIE żyje
/// w tym agregacie — robi ją handler komendy PRZED wywołaniem <see cref="AddMember"/>
/// (<c>IRoleQueries.IsAncestorAsync</c>), a agregat dostaje już zweryfikowany fakt.</para>
///
/// <para><b>Tylko allow.</b> Brak jakiejkolwiek formy <c>deny</c> — uzasadnienie w
/// <c>docs/architecture/security.md</c> §2.</para>
/// </summary>
public class Role : AggregateRoot
{
    private readonly List<RolePermissionEntry> _permissions = [];
    private readonly List<RoleMemberEntry> _memberRoleUuids = [];

    /// <summary>Konstruktor dla EF Core.</summary>
    protected Role()
    {
    }

    private Role(Guid uuid, string code, string name, string? description, bool isSystem) : base(uuid)
    {
        Code = code;
        Name = name;
        Description = description;
        IsSystem = isSystem;
    }

    /// <summary>Stabilny identyfikator tekstowy (np. <c>administrator</c>) — używany w seedzie
    /// i logach; nazwa wyświetlana (<see cref="Name"/>) może się zmieniać swobodnie.</summary>
    public string Code { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    /// <summary>Rola systemowa (np. <c>administrator</c> z seedu) — nie da się jej usunąć
    /// ani odebrać jej uprawnień przez UI, tylko przez migrację.</summary>
    public bool IsSystem { get; private set; }

    /// <summary>Kody uprawnień z <see cref="Erp.BuildingBlocks.Contracts.Permissions"/>
    /// przypisane BEZPOŚREDNIO tej roli (bez uwzględnienia ról składowych).</summary>
    public IReadOnlyList<string> Permissions => [.. _permissions.Select(p => p.PermissionCode)];

    /// <summary>Role, których uprawnienia ta rola przejmuje — patrz uwaga o kierunku wyżej.</summary>
    public IReadOnlyList<Guid> MemberRoleUuids => [.. _memberRoleUuids.Select(m => m.MemberRoleUuid)];

    public static Role Create(string code, string name, string? description = null, bool isSystem = false)
        => new(NewUuid(), ValidateCode(code), ValidateName(name), description, isSystem);

    /// <summary>Odtwarza rolę o znanym identyfikatorze — wyłącznie dla seedera (patrz
    /// uzasadnienie przy <c>Sales.Domain.Customers.Customer.CreateWithUuid</c>).</summary>
    public static Role CreateWithUuid(
        Guid uuid, string code, string name, string? description = null, bool isSystem = false)
        => new(uuid, ValidateCode(code), ValidateName(name), description, isSystem);

    public void Rename(string name, string? description)
    {
        Name = ValidateName(name);
        Description = description;
    }

    public void AddPermission(string permissionCode)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(permissionCode);

        if (_permissions.Any(p => string.Equals(p.PermissionCode, permissionCode, StringComparison.Ordinal)))
        {
            return;
        }

        _permissions.Add(RolePermissionEntry.Create(permissionCode));
    }

    public void RemovePermission(string permissionCode)
    {
        if (IsSystem)
        {
            throw new DomainException(
                "role_system_immutable", $"Rola systemowa '{Code}' nie może stracić uprawnień przez UI.");
        }

        _permissions.RemoveAll(p => string.Equals(p.PermissionCode, permissionCode, StringComparison.Ordinal));
    }

    /// <summary>
    /// Dołącza rolę składową. <paramref name="cycleCheckedByCaller"/> jest wymagane jawnie
    /// (nie ma wartości domyślnej) — metoda NIE umie sama sprawdzić cyklu (patrz komentarz
    /// klasy), więc parametr wymusza, żeby wywołujący pamiętał o zapytaniu przed wywołaniem,
    /// zamiast cicho przyjąć „prawdopodobnie sprawdzone”.
    /// </summary>
    public void AddMember(Guid memberRoleUuid, bool cycleCheckedByCaller)
    {
        if (!cycleCheckedByCaller)
        {
            throw new InvalidOperationException(
                "Wywołujący musi jawnie potwierdzić, że sprawdził cykl przez IRoleQueries.IsAncestorAsync " +
                "przed wywołaniem AddMember — agregat nie ma dostępu do bazy.");
        }

        if (memberRoleUuid == Uuid)
        {
            throw new DomainException("role_self_membership", "Rola nie może zawierać samej siebie.");
        }

        if (_memberRoleUuids.Any(m => m.MemberRoleUuid == memberRoleUuid))
        {
            return;
        }

        _memberRoleUuids.Add(RoleMemberEntry.Create(memberRoleUuid));
    }

    public void RemoveMember(Guid memberRoleUuid)
        => _memberRoleUuids.RemoveAll(m => m.MemberRoleUuid == memberRoleUuid);

    private static string ValidateCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new DomainException("role_code_empty", "Kod roli nie może być pusty.");
        }

        return code.Trim().ToLowerInvariant();
    }

    private static string ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new DomainException("role_name_empty", "Nazwa roli nie może być pusta.");
        }

        return name.Trim();
    }
}
