using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.IssueTypes;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie schematu typów zgłoszeń razem z typami — to jeden agregat, więc ładuje
/// się i zapisuje w całości (wzorzec identyczny jak <see cref="WorkflowSchemeConfiguration"/>).</summary>
public sealed class IssueTypeSchemeConfiguration : IEntityTypeConfiguration<IssueTypeScheme>
{
    public void Configure(EntityTypeBuilder<IssueTypeScheme> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue_type_scheme");
        builder.HasKey(s => s.Uuid);

        builder.Property(s => s.Name).HasMaxLength(256).IsRequired();
        builder.Property(s => s.IsSystem).IsRequired();

        builder.HasMany(s => s.Types)
            .WithOne()
            .HasForeignKey(t => t.SchemeUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(s => s.Types).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>Mapowanie typu zgłoszenia. Unikalność kodu w obrębie schematu, tak samo jak stan
/// w schemacie stanów.</summary>
public sealed class IssueTypeConfiguration : IEntityTypeConfiguration<IssueType>
{
    public void Configure(EntityTypeBuilder<IssueType> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue_type");
        builder.HasKey(t => t.Uuid);

        // Klucz nadaje agregat, nie baza — patrz `workflow_state`.
        builder.Property(t => t.Uuid).ValueGeneratedNever();

        builder.Property(t => t.SchemeUuid).IsRequired();
        builder.Property(t => t.Code).HasMaxLength(64).IsRequired();
        builder.Property(t => t.Name).HasMaxLength(256).IsRequired();
        builder.Property(t => t.NameKey).HasMaxLength(256);
        builder.Property(t => t.Icon).HasMaxLength(128).IsRequired();
        builder.Property(t => t.Category).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(t => t.OrderNo).IsRequired();
        builder.Property(t => t.WorkflowSchemeUuid);
        builder.Property(t => t.FieldSchemeUuid);

        builder.HasIndex(t => new { t.SchemeUuid, t.Code }).IsUnique();
    }
}
