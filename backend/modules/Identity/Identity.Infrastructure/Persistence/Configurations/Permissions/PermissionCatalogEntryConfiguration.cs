using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Identity.Infrastructure.Persistence.Configurations.Permissions;

public sealed class PermissionCatalogEntryConfiguration : IEntityTypeConfiguration<PermissionCatalogEntry>
{
    public void Configure(EntityTypeBuilder<PermissionCatalogEntry> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("permission_catalog");
        builder.HasKey(p => p.Code);

        builder.Property(p => p.Code).HasMaxLength(128).IsRequired();
        builder.Property(p => p.Module).HasMaxLength(64).IsRequired();
        builder.Property(p => p.Resource).HasMaxLength(64).IsRequired();
        builder.Property(p => p.Action).HasMaxLength(64).IsRequired();
        builder.Property(p => p.DescriptionKey).HasMaxLength(256).IsRequired();
        builder.Property(p => p.IsObsolete).IsRequired();
    }
}
