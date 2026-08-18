namespace Identity.Domain.Roles;

/// <summary>
/// Jedno uprawnienie bezpośrednio przypisane roli. Owinięte w encję zamiast gołego
/// <c>string</c> w kolekcji, bo EF Core owned collections wymagają typu referencyjnego —
/// mapowanie surowego <c>List&lt;string&gt;</c> jako encji własnej nie jest wspierane.
/// Wyłącznie techniczny szczegół persystencji; publiczne API <see cref="Role.Permissions"/>
/// zostaje płaskim <c>IReadOnlyList&lt;string&gt;</c>.
/// </summary>
public sealed class RolePermissionEntry
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private RolePermissionEntry()
    {
    }

    private RolePermissionEntry(string permissionCode) => PermissionCode = permissionCode;

    public string PermissionCode { get; private set; } = string.Empty;

    public static RolePermissionEntry Create(string permissionCode) => new(permissionCode);
}
