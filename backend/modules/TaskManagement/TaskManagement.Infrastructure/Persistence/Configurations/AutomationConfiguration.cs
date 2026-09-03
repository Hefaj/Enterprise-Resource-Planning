using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Automation;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie reguły automatyzacji razem z akcjami — jeden agregat, ładuje się i zapisuje
/// w całości (AUT-001), wzorem <c>WorkflowSchemeConfiguration</c>.</summary>
public sealed class AutomationRuleConfiguration : IEntityTypeConfiguration<AutomationRule>
{
    public void Configure(EntityTypeBuilder<AutomationRule> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("automation_rule");
        builder.HasKey(r => r.Uuid);

        builder.Property(r => r.ProjectUuid).IsRequired();
        builder.Property(r => r.Name).HasMaxLength(128).IsRequired();
        builder.Property(r => r.TriggerKind).HasConversion<string>().HasMaxLength(32).IsRequired();

        // Opaque dla API na wejściu/wyjściu (patrz AutomationConditionSerializer) — zwykły
        // tekst, nie jsonb, tym samym uzasadnieniem co `SavedView.FilterJson`.
        builder.Property(r => r.ConditionJson).HasColumnType("text");

        builder.Property(r => r.IsEnabled).IsRequired();
        builder.Property(r => r.CreatedAt).IsRequired();

        builder.HasMany(r => r.Actions)
            .WithOne()
            .HasForeignKey(a => a.RuleUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(r => r.Actions).UsePropertyAccessMode(PropertyAccessMode.Field);

        // Silnik wykonawczy ładuje reguły włączone projektu po wyzwalaczu na każdy trigger —
        // patrz `AutomationRuleRepository.FindEnabledByTriggerAsync`.
        builder.HasIndex(r => new { r.ProjectUuid, r.TriggerKind, r.IsEnabled });
    }
}

/// <summary>Mapowanie akcji reguły.</summary>
public sealed class AutomationActionConfiguration : IEntityTypeConfiguration<AutomationAction>
{
    public void Configure(EntityTypeBuilder<AutomationAction> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("automation_action");
        builder.HasKey(a => a.Uuid);

        // Klucz nadaje agregat, nie baza — patrz `field_definition`/`workflow_state`.
        builder.Property(a => a.Uuid).ValueGeneratedNever();

        builder.Property(a => a.RuleUuid).IsRequired();
        builder.Property(a => a.Kind).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(a => a.ConfigJson).HasColumnType("text").IsRequired();
        builder.Property(a => a.OrderNo).IsRequired();
    }
}

/// <summary>Mapowanie logu uruchomień (AUT-002 AC1) — tylko do dopisywania, wzorem
/// <c>IssueActivityConfiguration</c>.</summary>
public sealed class AutomationRunConfiguration : IEntityTypeConfiguration<AutomationRun>
{
    public void Configure(EntityTypeBuilder<AutomationRun> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("automation_run");
        builder.HasKey(r => r.Uuid);

        builder.Property(r => r.RuleUuid).IsRequired();
        builder.Property(r => r.IssueUuid).IsRequired();
        builder.Property(r => r.Outcome).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(r => r.ErrorMessage).HasMaxLength(AutomationRun.MaxErrorMessageLength);
        builder.Property(r => r.OccurredAt).IsRequired();

        // Panel „Log uruchomień" (AUT-002 AC1) pyta o ostatnie N wpisów jednej reguły —
        // patrz `AutomationRuleQueries.GetRecentRunsAsync`.
        builder.HasIndex(r => new { r.RuleUuid, r.OccurredAt });
    }
}
