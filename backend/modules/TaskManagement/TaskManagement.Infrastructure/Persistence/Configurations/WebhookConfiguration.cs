using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TaskManagement.Domain.Automation;
using TaskManagement.Domain.Webhooks;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie webhooka (API-004) — agregat własny, wzorem <c>AutomationRuleConfiguration</c>.</summary>
public sealed class WebhookConfiguration : IEntityTypeConfiguration<Webhook>
{
    /// <summary>
    /// <see cref="Webhook.EventKinds"/> jest listą enumów, nie stringów — inaczej niż
    /// <c>WorkflowTransition._requiredFields</c> (który jest wprost <c>List&lt;string&gt;</c> i
    /// mapuje się na <c>text[]</c> bez konwertera). Tu trzeba przejść przez nazwę na czas
    /// zapisu/odczytu, żeby kolumna została czytelnym <c>text[]</c>, a nie tablicą liczb, które
    /// nic nie znaczą bez zaglądania do enuma w kodzie.
    /// </summary>
    private static readonly ValueConverter<List<AutomationTriggerKind>, List<string>> EventKindsConverter = new(
        kinds => kinds.Select(k => k.ToString()).ToList(),
        names => names.Select(Enum.Parse<AutomationTriggerKind>).ToList());

    /// <summary>Porównywanie po wartości i kopia przy migawce — ten sam powód co
    /// <c>IssueConfiguration.CustomFieldsComparer</c>: bez tego EF trzymałby referencję do tej
    /// samej listy i nigdy nie zobaczyłby zmiany zestawu zdarzeń jako różnicy do zapisania.</summary>
    private static readonly ValueComparer<List<AutomationTriggerKind>> EventKindsComparer = new(
        (left, right) => left != null && right != null && left.SequenceEqual(right),
        value => value.Aggregate(0, (hash, k) => HashCode.Combine(hash, k)),
        value => value.ToList());

    public void Configure(EntityTypeBuilder<Webhook> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("webhook");
        builder.HasKey(w => w.Uuid);

        builder.Property(w => w.ProjectUuid).IsRequired();
        builder.Property(w => w.Url).HasMaxLength(2048).IsRequired();
        builder.Property(w => w.Secret).HasMaxLength(256).IsRequired();

        builder.Property<List<AutomationTriggerKind>>("_eventKinds")
            .HasColumnName("event_kinds")
            .HasColumnType("text[]")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .HasConversion(EventKindsConverter, EventKindsComparer)
            .IsRequired();

        builder.Ignore(w => w.EventKinds);

        builder.Property(w => w.IsEnabled).IsRequired();
        builder.Property(w => w.ConsecutiveFailureCount).IsRequired();
        builder.Property(w => w.CreatedAt).IsRequired();

        // Dyspozytor szuka webhooków projektu włączonych na dany trigger — patrz
        // `WebhookRepository.FindEnabledByProjectAsync`.
        builder.HasIndex(w => new { w.ProjectUuid, w.IsEnabled });
    }
}

/// <summary>Mapowanie dostarczenia (patrz uzasadnienie mutowalności w <see cref="WebhookDelivery"/>).</summary>
public sealed class WebhookDeliveryConfiguration : IEntityTypeConfiguration<WebhookDelivery>
{
    public void Configure(EntityTypeBuilder<WebhookDelivery> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("webhook_delivery");
        builder.HasKey(d => d.Uuid);

        builder.Property(d => d.WebhookUuid).IsRequired();
        builder.Property(d => d.IssueUuid).IsRequired();
        builder.Property(d => d.EventKind).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(d => d.PayloadJson).HasColumnType("text").IsRequired();
        builder.Property(d => d.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(d => d.AttemptCount).IsRequired();
        builder.Property(d => d.NextAttemptAt).IsRequired();
        builder.Property(d => d.LastError).HasMaxLength(WebhookDelivery.MaxErrorMessageLength);
        builder.Property(d => d.CreatedAt).IsRequired();

        // Dyspozytor (`WebhookDeliveryDispatcher`) wybiera due-dostarczenia w stanie Pending —
        // ten sam wzorzec `FOR UPDATE SKIP LOCKED` co `BulkCommandRunner`/`ReportRunner`.
        builder.HasIndex(d => new { d.Status, d.NextAttemptAt });

        // Panel „Dostarczenia" na karcie webhooka pyta o ostatnie N wpisów jednego webhooka.
        builder.HasIndex(d => new { d.WebhookUuid, d.CreatedAt });
    }
}
