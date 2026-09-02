using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Tags;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="Tag"/> (TAG-001).</summary>
public sealed class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("tag");
        builder.HasKey(t => t.Uuid);

        builder.Property(t => t.ProjectUuid);
        builder.Property(t => t.Name).HasMaxLength(64).IsRequired();
        builder.Property(t => t.Color).HasMaxLength(16).IsRequired();

        // Tag globalny (`project_uuid` NULL) obok tagów projektowych o tej samej nazwie —
        // Postgres traktuje NULL jako różne wartości w indeksie unikalnym, więc para
        // (NULL, "backend") nigdy się nie zduplikuje, ale to nie jest luka: TAG-002 i tak
        // pyta o istniejące tagi PRZED założeniem nowego (`ITagQueries.SearchAsync`).
        builder.HasIndex(t => new { t.ProjectUuid, t.Name }).IsUnique();
    }
}
