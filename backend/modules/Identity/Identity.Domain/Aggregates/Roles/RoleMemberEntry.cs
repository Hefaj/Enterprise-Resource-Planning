namespace Identity.Domain.Roles;

/// <summary>
/// Jedna rola składowa — patrz uzasadnienie opakowania w <see cref="RolePermissionEntry"/>.
/// Kierunek: rola-właściciel tej kolekcji jest KONTENEREM, <see cref="MemberRoleUuid"/>
/// wskazuje SKŁADOWĄ, której uprawnienia kontener przejmuje.
/// </summary>
public sealed class RoleMemberEntry
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private RoleMemberEntry()
    {
    }

    private RoleMemberEntry(Guid memberRoleUuid) => MemberRoleUuid = memberRoleUuid;

    public Guid MemberRoleUuid { get; private set; }

    public static RoleMemberEntry Create(Guid memberRoleUuid) => new(memberRoleUuid);
}
