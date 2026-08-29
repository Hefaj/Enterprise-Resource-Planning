using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Notification.Domain.UserNotifications;

namespace Notification.Infrastructure.Persistence.Configurations;

public sealed class UserNotificationConfiguration : IEntityTypeConfiguration<UserNotification>
{
    public void Configure(EntityTypeBuilder<UserNotification> builder)
    {
        builder.ToTable("user_notification");
        builder.HasKey(x => x.Uuid);
        builder.Property(x => x.Kind).HasMaxLength(128).IsRequired();
        builder.Property(x => x.SubjectSignature).HasMaxLength(128).IsRequired();
        builder.Property(x => x.SubjectKey).HasMaxLength(64);
        builder.Property(x => x.TitleKey).HasMaxLength(256).IsRequired();
        builder.Property(x => x.ParamsJson).HasColumnName("params").HasColumnType("jsonb");
        builder.Property(x => x.GroupKey).HasMaxLength(256);
        builder.Property(x => x.CorrelationId).IsRequired();
        builder.Property(x => x.Link).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Severity).HasConversion<int>();
        builder.HasIndex(x => new { x.UserUuid, x.CreatedAt }).IsDescending(false, true);
        builder.HasIndex(x => x.UserUuid)
            .HasDatabaseName("ix_user_notification_unread")
            .HasFilter("read_at IS NULL");
        builder.HasIndex(x => new { x.UserUuid, x.GroupKey })
            .IsUnique()
            .HasDatabaseName("ix_user_notification_active_group")
            .HasFilter("group_key IS NOT NULL AND read_at IS NULL");
        builder.HasIndex(x => new { x.UserUuid, x.Kind, x.SubjectUuid, x.CorrelationId })
            .IsUnique()
            .HasDatabaseName("ix_user_notification_ungrouped_dedup")
            .HasFilter("group_key IS NULL");
    }
}
