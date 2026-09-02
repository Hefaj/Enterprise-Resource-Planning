using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.WorkTypes;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie słownika rodzajów pracy (TIME-001 AC2) — wzorem <c>TagConfiguration</c>.</summary>
public sealed class WorkTypeConfiguration : IEntityTypeConfiguration<WorkType>
{
    public void Configure(EntityTypeBuilder<WorkType> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("work_type");
        builder.HasKey(t => t.Uuid);

        builder.Property(t => t.ProjectUuid);
        builder.Property(t => t.Name).HasMaxLength(64).IsRequired();

        builder.HasIndex(t => new { t.ProjectUuid, t.Name }).IsUnique();
    }
}
