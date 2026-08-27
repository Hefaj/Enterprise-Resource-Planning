using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="Issue"/>.</summary>
public sealed class IssueConfiguration : IEntityTypeConfiguration<Issue>
{
    public void Configure(EntityTypeBuilder<Issue> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue");
        builder.HasKey(i => i.Uuid);

        builder.Property(i => i.ProjectUuid).IsRequired();
        builder.Property(i => i.Key).HasMaxLength(32).IsRequired();
        builder.Property(i => i.Title).HasMaxLength(512).IsRequired();
        builder.Property(i => i.Description);
        builder.Property(i => i.Priority).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(i => i.StateUuid).IsRequired();
        builder.Property(i => i.ReporterUuid).IsRequired();
        builder.Property(i => i.IsRestricted).IsRequired();
        builder.Property(i => i.CreatedAt).IsRequired();
        builder.Property(i => i.UpdatedAt).IsRequired();

        // Klucze historyczne to lista tekstów, nie tabela podrzędna: nie mają własnych atrybutów,
        // nikt po nich nie sortuje, a jedyne zapytanie brzmi „czy zawiera ten klucz”.
        builder.Property<List<string>>("_previousKeys")
            .HasColumnName("previous_keys")
            .HasColumnType("text[]")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .IsRequired();

        builder.Ignore(i => i.PreviousKeys);

        // Niezmiennik „klucz zgłoszenia jest unikalny globalnie” egzekwuje INDEKS BAZY,
        // nie kod aplikacji — dokładnie jak „dokument w jednym obiegu” w DMS
        // (docs/backend/task-management.md §3).
        builder.HasIndex(i => i.Key).IsUnique();

        builder.HasIndex(i => new { i.ProjectUuid, i.StateUuid });
        builder.HasIndex(i => i.AssigneeUuid);
        builder.HasIndex(i => i.ReporterUuid);

        // Skan terminów (faza 5) idzie po tym indeksie, nie po wpisie harmonogramu per zgłoszenie —
        // rozdzielczość jest dzienna, więc drugi mechanizm z DMS-u byłby kosztem bez zysku (§9.3).
        builder.HasIndex(i => i.DueAt);

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(i => i.ProjectUuid)
            .OnDelete(DeleteBehavior.Restrict);

        // Rodzic bez klucza obcego do samego siebie z kaskadą: usunięcie epiku nie może
        // wykasować podzadań po cichu. Hierarchię wypełnia faza 4.
        builder.HasIndex(i => i.ParentUuid);
    }
}
