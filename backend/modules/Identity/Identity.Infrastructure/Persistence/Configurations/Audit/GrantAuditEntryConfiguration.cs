using Identity.Domain.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Identity.Infrastructure.Persistence.Configurations.Audit;

/// <summary>Mapowanie <see cref="GrantAuditEntry"/> — bez FK do <c>role</c>/<c>user_account</c>
/// (patrz uzasadnienie na encji), bez <c>xmin</c> (nie jest <c>AggregateRoot</c>, wiersze nigdy
/// się nie aktualizują).</summary>
public sealed class GrantAuditEntryConfiguration : IEntityTypeConfiguration<GrantAuditEntry>
{
    public void Configure(EntityTypeBuilder<GrantAuditEntry> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("grant_audit");
        builder.HasKey(e => e.Uuid);

        builder.Property(e => e.OccurredAt).IsRequired();
        builder.Property(e => e.ActorUserUuid).IsRequired();
        builder.Property(e => e.SubjectType).HasMaxLength(16).IsRequired();
        builder.Property(e => e.SubjectUuid).IsRequired();
        builder.Property(e => e.Action).HasMaxLength(64).IsRequired();
        builder.Property(e => e.TargetCode).HasMaxLength(256).IsRequired();
        builder.Property(e => e.Reason).HasMaxLength(512);
        builder.Property(e => e.Source).HasMaxLength(32).IsRequired();

        builder.HasIndex(e => e.SubjectUuid);
        builder.HasIndex(e => e.OccurredAt);
    }
}
