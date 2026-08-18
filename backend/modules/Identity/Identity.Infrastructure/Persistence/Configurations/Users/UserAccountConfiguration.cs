using Identity.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Identity.Infrastructure.Persistence.Configurations.Users;

/// <summary>Mapowanie agregatu <see cref="UserAccount"/> — <see cref="UserAccount.RoleGrants"/>
/// i <see cref="UserAccount.PermissionGrants"/> jako kolekcje własne w tabelach
/// <c>user_role</c>/<c>user_permission</c> (patrz <c>docs/backend/identity-authz.md</c> §2).</summary>
public sealed class UserAccountConfiguration : IEntityTypeConfiguration<UserAccount>
{
    public void Configure(EntityTypeBuilder<UserAccount> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("user_account");
        builder.HasKey(u => u.Uuid);

        builder.Property(u => u.Email).HasMaxLength(320).IsRequired();
        builder.Property(u => u.DisplayName).HasMaxLength(256).IsRequired();
        builder.Property(u => u.IsActive).IsRequired();
        builder.Property(u => u.SyncedAt).IsRequired();

        builder.HasIndex(u => u.Email).IsUnique();

        builder.OwnsMany(u => u.RoleGrants, grants =>
        {
            grants.ToTable("user_role");
            grants.WithOwner().HasForeignKey("user_uuid");
            grants.Property(g => g.RoleUuid).HasColumnName("role_uuid").IsRequired();
            grants.Property(g => g.GrantedAt).HasColumnName("granted_at").IsRequired();
            grants.Property(g => g.GrantedBy).HasColumnName("granted_by").HasMaxLength(64);
            grants.Property(g => g.ExpiresAt).HasColumnName("expires_at");
            grants.HasKey("user_uuid", nameof(UserRoleGrant.RoleUuid));
            grants.HasIndex(g => g.RoleUuid);
        });

        builder.OwnsMany(u => u.PermissionGrants, grants =>
        {
            grants.ToTable("user_permission");
            grants.WithOwner().HasForeignKey("user_uuid");
            grants.Property(g => g.PermissionCode).HasColumnName("permission_code").HasMaxLength(128).IsRequired();
            grants.Property(g => g.GrantedAt).HasColumnName("granted_at").IsRequired();
            grants.Property(g => g.GrantedBy).HasColumnName("granted_by").HasMaxLength(64);
            grants.Property(g => g.Reason).HasColumnName("reason").HasMaxLength(512).IsRequired();
            grants.HasKey("user_uuid", nameof(UserPermissionGrant.PermissionCode));
        });

        builder.Navigation(u => u.RoleGrants).HasField("_roleGrants").UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(u => u.PermissionGrants)
            .HasField("_permissionGrants")
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
