using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

public sealed class WorkLogConfiguration : IEntityTypeConfiguration<WorkLog>
{
    public void Configure(EntityTypeBuilder<WorkLog> builder)
    {
        builder.ToTable("work_log");
        builder.HasKey(x => x.Uuid);
        builder.Property(x => x.Note).HasMaxLength(4000);
        builder.HasIndex(x => new { x.IssueUuid, x.LoggedAt });
    }
}

public sealed class SavedIssueViewConfiguration : IEntityTypeConfiguration<SavedIssueView>
{
    public void Configure(EntityTypeBuilder<SavedIssueView> builder)
    {
        builder.ToTable("saved_issue_view");
        builder.HasKey(x => x.Uuid);
        builder.Property(x => x.Name).HasMaxLength(256).IsRequired();
        builder.Property(x => x.FilterJson).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.ColumnsJson).HasColumnType("jsonb").IsRequired();
        builder.HasIndex(x => new { x.OwnerUuid, x.Name }).IsUnique();
        builder.HasIndex(x => x.OwnerUuid).HasFilter("is_default = true").IsUnique();
    }
}
