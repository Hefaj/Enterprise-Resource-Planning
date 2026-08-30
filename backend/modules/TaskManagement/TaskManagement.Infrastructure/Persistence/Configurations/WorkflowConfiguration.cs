using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Text.Json;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie schematu stanów razem ze stanami i przejściami — to jeden agregat,
/// więc ładuje się i zapisuje w całości.</summary>
public sealed class WorkflowSchemeConfiguration : IEntityTypeConfiguration<WorkflowScheme>
{
    public void Configure(EntityTypeBuilder<WorkflowScheme> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("workflow_scheme");
        builder.HasKey(s => s.Uuid);

        builder.Property(s => s.Name).HasMaxLength(256).IsRequired();
        builder.Property(s => s.IsSystem).IsRequired();

        builder.HasMany(s => s.States)
            .WithOne()
            .HasForeignKey(s => s.SchemeUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(s => s.Transitions)
            .WithOne()
            .HasForeignKey(t => t.SchemeUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(s => s.States).UsePropertyAccessMode(PropertyAccessMode.Field);
        builder.Navigation(s => s.Transitions).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>Mapowanie stanu.</summary>
public sealed class WorkflowStateConfiguration : IEntityTypeConfiguration<WorkflowState>
{
    public void Configure(EntityTypeBuilder<WorkflowState> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("workflow_state");
        builder.HasKey(s => s.Uuid);

        // Klucz nadaje agregat, nie baza — patrz `field_definition`. Dziś dokłada je wyłącznie
        // seed razem z całym schematem, ale edytor schematu z fazy 7 doda je do istniejącego.
        builder.Property(s => s.Uuid).ValueGeneratedNever();

        builder.Property(s => s.SchemeUuid).IsRequired();
        builder.Property(s => s.Code).HasMaxLength(64).IsRequired();
        builder.Property(s => s.NameKey).HasMaxLength(256).IsRequired();
        builder.Property(s => s.Category).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(s => s.OrderNo).IsRequired();

        builder.HasIndex(s => new { s.SchemeUuid, s.Code }).IsUnique();
    }
}

/// <summary>Mapowanie przejścia. Unikalność po parze (z, do) w schemacie — dwa identyczne
/// przejścia różniłyby się tylko nazwą, a wtedy nie wiadomo, które wykonał użytkownik.</summary>
public sealed class WorkflowTransitionConfiguration : IEntityTypeConfiguration<WorkflowTransition>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly ValueConverter<List<string>, string> RequiredFieldCodesConverter = new(
        value => JsonSerializer.Serialize(value, JsonOptions),
        json => JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? new List<string>());

    private static readonly ValueComparer<List<string>> RequiredFieldCodesComparer = new(
        (left, right) => left != null && right != null && left.SequenceEqual(right, StringComparer.Ordinal),
        value => value.Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode(StringComparison.Ordinal))),
        value => value.ToList());

    public void Configure(EntityTypeBuilder<WorkflowTransition> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("workflow_transition");
        builder.HasKey(t => t.Uuid);

        // Klucz nadaje agregat, nie baza — patrz `field_definition`. Dziś dokłada je wyłącznie
        // seed razem z całym schematem, ale edytor schematu z fazy 7 doda je do istniejącego.
        builder.Property(t => t.Uuid).ValueGeneratedNever();

        builder.Property(t => t.SchemeUuid).IsRequired();
        builder.Property(t => t.FromStateUuid).IsRequired();
        builder.Property(t => t.ToStateUuid).IsRequired();
        builder.Property(t => t.NameKey).HasMaxLength(256).IsRequired();
        builder.Property(t => t.RequiredPermission).HasMaxLength(128);
        builder.Property<List<string>>("_requiredFieldCodes")
            .HasColumnName("required_field_codes")
            .HasColumnType("jsonb")
            .HasConversion(RequiredFieldCodesConverter, RequiredFieldCodesComparer)
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasDefaultValueSql("'[]'::jsonb")
            .IsRequired();

        builder.Ignore(t => t.RequiredFieldCodes);

        builder.HasIndex(t => new { t.SchemeUuid, t.FromStateUuid, t.ToStateUuid }).IsUnique();
    }
}
