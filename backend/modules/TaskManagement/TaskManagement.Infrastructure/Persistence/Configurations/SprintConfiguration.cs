using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.Sprints;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Trwały sprint. Częściowy indeks niżej jest gwarancją, że tablica ma najwyżej
/// jedną aktywną iterację także przy równoległych żądaniach.</summary>
public sealed class SprintConfiguration : IEntityTypeConfiguration<Sprint>
{
    public void Configure(EntityTypeBuilder<Sprint> builder)
    {
        builder.ToTable("sprint");
        builder.HasKey(sprint => sprint.Uuid);
        builder.Property(sprint => sprint.BoardUuid).IsRequired();
        builder.Property(sprint => sprint.Name).HasMaxLength(256).IsRequired();
        builder.Property(sprint => sprint.StartOn).IsRequired();
        builder.Property(sprint => sprint.EndOn).IsRequired();
        builder.Property(sprint => sprint.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.HasIndex(sprint => sprint.BoardUuid);
        builder.HasIndex(sprint => sprint.BoardUuid)
            .HasFilter("status = 'Active'")
            .IsUnique();
        builder.HasOne<Board>().WithMany().HasForeignKey(sprint => sprint.BoardUuid).OnDelete(DeleteBehavior.Cascade);
    }
}
