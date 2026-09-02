using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Resolutions;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="Resolution"/> (ISS-007).</summary>
public sealed class ResolutionConfiguration : IEntityTypeConfiguration<Resolution>
{
    public void Configure(EntityTypeBuilder<Resolution> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("resolution");
        builder.HasKey(r => r.Uuid);

        builder.Property(r => r.ProjectUuid);
        builder.Property(r => r.Name).HasMaxLength(128).IsRequired();
        builder.Property(r => r.NameKey).HasMaxLength(128);
        builder.Property(r => r.IsSystem).IsRequired();
        builder.Property(r => r.OrderNo).IsRequired();

        builder.HasIndex(r => new { r.ProjectUuid, r.Name }).IsUnique();
    }
}
