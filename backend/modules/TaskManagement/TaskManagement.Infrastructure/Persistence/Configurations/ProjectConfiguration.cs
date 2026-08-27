using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Projects;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="Project"/> razem z członkami.</summary>
public sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("project");
        builder.HasKey(p => p.Uuid);

        builder.Property(p => p.Code).HasMaxLength(16).IsRequired();
        builder.Property(p => p.Name).HasMaxLength(256).IsRequired();
        builder.Property(p => p.Kind).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(p => p.WorkflowSchemeUuid).IsRequired();
        builder.Property(p => p.IsPublic).IsRequired();

        builder.HasIndex(p => p.Code).IsUnique();

        builder.HasMany(p => p.Members)
            .WithOne()
            .HasForeignKey(m => m.ProjectUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(p => p.Members).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>Mapowanie członkostwa. Unikalność po parze (projekt, użytkownik) jest w bazie,
/// nie w kodzie — dwa równoległe nadania tej samej osoby to zwykły wyścig, a nie rzadkość.</summary>
public sealed class ProjectMemberConfiguration : IEntityTypeConfiguration<ProjectMember>
{
    public void Configure(EntityTypeBuilder<ProjectMember> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("project_member");
        builder.HasKey(m => m.Uuid);

        builder.Property(m => m.ProjectUuid).IsRequired();
        builder.Property(m => m.UserUuid).IsRequired();
        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(16).IsRequired();

        builder.HasIndex(m => new { m.ProjectUuid, m.UserUuid }).IsUnique();

        // Predykat widoczności listy zgłoszeń startuje od „w których projektach jestem” —
        // bez tego indeksu każde wyszukiwanie zaczyna się od skanu członkostw.
        builder.HasIndex(m => m.UserUuid);
    }
}

/// <summary>
/// Mapowanie licznika numeracji. Klucz główny to <c>project_uuid</c>, nie sztuczny <c>uuid</c> —
/// licznik jest jednym wierszem na projekt i to po nim celuje <c>UPDATE … RETURNING</c>.
/// </summary>
public sealed class ProjectKeyCounterConfiguration : IEntityTypeConfiguration<ProjectKeyCounter>
{
    public void Configure(EntityTypeBuilder<ProjectKeyCounter> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("project_key_counter");
        builder.HasKey(c => c.ProjectUuid);

        builder.Property(c => c.Prefix).HasMaxLength(16).IsRequired();
        builder.Property(c => c.NextNumber).IsRequired();

        builder.HasOne<Project>()
            .WithOne()
            .HasForeignKey<ProjectKeyCounter>(c => c.ProjectUuid)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
