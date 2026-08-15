using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Notification.Domain.Jobs;

namespace Notification.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie repliki <see cref="NotificationJob"/>.</summary>
public sealed class NotificationJobConfiguration : IEntityTypeConfiguration<NotificationJob>
{
    public void Configure(EntityTypeBuilder<NotificationJob> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("job");
        builder.HasKey(j => j.Uuid);

        builder.Property(j => j.QueueId).HasMaxLength(128);
        builder.Property(j => j.TrackingId).HasMaxLength(64).IsRequired();
        builder.Property(j => j.CommandType).HasMaxLength(256).IsRequired();
        builder.Property(j => j.CommandJson).HasColumnType("jsonb");
        builder.Property(j => j.ErrorsSummary).HasMaxLength(2048);
        builder.Property(j => j.UserId).HasMaxLength(128);
        builder.Property(j => j.ClientId).HasMaxLength(128);
        builder.Property(j => j.UiMetadata).HasColumnType("jsonb");

        // Status jako int, nie string: wartości są kontraktem numerycznym (patrz komentarz przy
        // NotificationJobStatus), a kolumna jest tylko odczytywana, nigdy nie filtrowana tekstem.
        builder.Property(j => j.Status).HasConversion<int>();

        // Predykaty filtrów searchJob: QueueId/TrackingId po ILIKE, UserId/ClientId po ILIKE,
        // IsComplete po równości — każdy dostaje własny indeks, bo wszystkie występują
        // w kontrakcie jako niezależne, opcjonalne filtry.
        builder.HasIndex(j => j.QueueId);
        builder.HasIndex(j => j.TrackingId);
        builder.HasIndex(j => j.UserId);
        builder.HasIndex(j => j.ClientId);
        builder.HasIndex(j => j.IsComplete);
        builder.HasIndex(j => j.CreatedAt);
    }
}
