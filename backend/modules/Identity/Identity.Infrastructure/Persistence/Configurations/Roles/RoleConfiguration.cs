using Identity.Domain.Roles;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Identity.Infrastructure.Persistence.Configurations.Roles;

/// <summary>
/// Mapowanie agregatu <see cref="Role"/>. <see cref="Role.Permissions"/> i
/// <see cref="Role.MemberRoleUuids"/> są na publicznym API płaskimi listami, ale w bazie żyją
/// jako kolekcje własne encji-opakowań (<see cref="RolePermissionEntry"/>,
/// <see cref="RoleMemberEntry"/>) w osobnych tabelach — <c>role_permission</c>/<c>role_member</c>,
/// zgodnie z modelem w <c>docs/backend/identity-authz.md</c> §2. Konfiguracja celuje w prywatne
/// pola (<c>OwnsMany("_permissions", ...)</c>), bo te encje-opakowania nie mają żadnej publicznej
/// nawigacji — cały sens opakowania jest czysto techniczny (EF nie potrafi mapować
/// <c>List&lt;string&gt;</c>/<c>List&lt;Guid&gt;</c> jako encji własnej wprost).
/// </summary>
public sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("role");
        builder.HasKey(r => r.Uuid);

        builder.Property(r => r.Code).HasMaxLength(128).IsRequired();
        builder.Property(r => r.Name).HasMaxLength(256).IsRequired();
        builder.Property(r => r.Description).HasMaxLength(1024);
        builder.Property(r => r.IsSystem).IsRequired();

        builder.HasIndex(r => r.Code).IsUnique();

        builder.OwnsMany<RolePermissionEntry>("_permissions", permissions =>
        {
            permissions.ToTable("role_permission");
            permissions.WithOwner().HasForeignKey("role_uuid");
            permissions.Property(p => p.PermissionCode).HasColumnName("permission_code").HasMaxLength(128).IsRequired();
            permissions.HasKey("role_uuid", nameof(RolePermissionEntry.PermissionCode));
        });

        // Kierunek: TA rola (kontener) zawiera rolę member_uuid (składowa) — patrz komentarz
        // klasy Role o konwencji nazewniczej container/member.
        builder.OwnsMany<RoleMemberEntry>("_memberRoleUuids", members =>
        {
            members.ToTable("role_member");
            members.WithOwner().HasForeignKey("container_uuid");
            members.Property(m => m.MemberRoleUuid).HasColumnName("member_uuid").IsRequired();
            members.HasKey("container_uuid", nameof(RoleMemberEntry.MemberRoleUuid));
            members.HasIndex(m => m.MemberRoleUuid);
        });

        builder.Metadata.FindNavigation("_permissions")!.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation("_memberRoleUuids")!.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
