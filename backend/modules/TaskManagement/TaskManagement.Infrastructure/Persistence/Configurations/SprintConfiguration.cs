using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.Sprints;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>
/// Mapowanie sprintu.
///
/// <para>Indeks <c>ix_sprint_board_active</c> niesie regułę: aktywny sprint na tablicy jest
/// najwyżej jeden. Egzekwuje ją baza, nie <see cref="Sprint"/> — dwie równoległe komendy
/// aktywacji na różnych sprintach tej samej tablicy przeszłyby walidację aplikacyjną obie
/// (<c>docs/backend/task-management.md</c> §3).</para>
/// </summary>
public sealed class SprintConfiguration : IEntityTypeConfiguration<Sprint>
{
    public void Configure(EntityTypeBuilder<Sprint> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("sprint");
        builder.HasKey(s => s.Uuid);

        builder.Property(s => s.BoardUuid).IsRequired();
        builder.Property(s => s.Name).HasMaxLength(256).IsRequired();
        builder.Property(s => s.Goal).HasMaxLength(2000);
        builder.Property(s => s.Status).HasConversion<string>().HasMaxLength(16).IsRequired();

        // Zapytanie listy sprintów tablicy filtruje po (board_uuid, status) — te dwie kolumny
        // pokrywają zarówno "wszystkie sprinty tablicy", jak i "aktywny sprint tablicy".
        builder.HasIndex(s => new { s.BoardUuid, s.Status }).HasDatabaseName("ix_sprint_board_status");

        builder.HasIndex(s => s.BoardUuid)
            .IsUnique()
            .HasDatabaseName("ix_sprint_board_active")
            .HasFilter($"status = '{nameof(SprintStatus.Active)}'");

        builder.HasOne<Board>()
            .WithMany()
            .HasForeignKey(s => s.BoardUuid)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
