using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Notification.Domain.UserNotifications;

namespace Notification.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie feedu <see cref="UserNotification"/>.</summary>
public sealed class UserNotificationConfiguration : IEntityTypeConfiguration<UserNotification>
{
    public void Configure(EntityTypeBuilder<UserNotification> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("user_notification");
        builder.HasKey(n => n.Uuid);

        builder.Property(n => n.UserId).HasMaxLength(128).IsRequired();
        builder.Property(n => n.ActorId).HasMaxLength(128);
        builder.Property(n => n.Kind).HasMaxLength(128).IsRequired();
        builder.Property(n => n.Severity).HasConversion<int>();
        builder.Property(n => n.SubjectSignature).HasMaxLength(64).IsRequired();
        builder.Property(n => n.SubjectKey).HasMaxLength(128);
        builder.Property(n => n.TitleKey).HasMaxLength(256).IsRequired();
        builder.Property(n => n.ParamsJson).HasColumnType("jsonb").IsRequired();
        builder.Property(n => n.GroupKey).HasMaxLength(256);
        builder.Property(n => n.Link).HasMaxLength(512).IsRequired();

        // Feed: `where user_uuid=@me order by created_at desc` — pytanie zadawane na każde
        // otwarcie dzwonka, musi trafiać w indeks bez sortowania w pamięci.
        builder.HasIndex(n => new { n.UserId, n.CreatedAt });

        // Licznik nieprzeczytanych w nagłówku — osobny, węższy indeks filtrowany, bo
        // `read_at is null` jest wybierane z każdego wiersza feedu przy każdym starcie aplikacji.
        builder.HasIndex(n => n.UserId).HasFilter("read_at IS NULL");

        // Deduplikacja po grupie — tylko wśród jeszcze nieprzeczytanych (patrz docs/backend/
        // user-notifications.md §4.2): odbiorca, który już przeczytał poprzednie wystąpienie,
        // ma dostać nowy wpis, nie cichą inkrementację czegoś, czego już nie zobaczy.
        builder.HasIndex(n => new { n.UserId, n.GroupKey })
            .IsUnique()
            .HasFilter("group_key IS NOT NULL AND read_at IS NULL");

        // Deduplikacja bez GroupKey — ta sama redostawa (at-least-once) tego samego faktu
        // nie ma prawa założyć drugiego wiersza.
        builder.HasIndex(n => new { n.UserId, n.Kind, n.SubjectUuid, n.CorrelationId });
    }
}
