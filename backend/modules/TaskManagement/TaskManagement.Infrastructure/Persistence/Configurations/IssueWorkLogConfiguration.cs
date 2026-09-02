using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie wpisu czasu (TIME-001) — agregat własny, wzorem
/// <c>IssueCommentConfiguration</c>, nie kolekcja podrzędna <c>Issue</c> (patrz uzasadnienie
/// przy <see cref="IssueWorkLog"/>).</summary>
public sealed class IssueWorkLogConfiguration : IEntityTypeConfiguration<IssueWorkLog>
{
    public void Configure(EntityTypeBuilder<IssueWorkLog> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue_work_log");
        builder.HasKey(w => w.Uuid);

        builder.Property(w => w.IssueUuid).IsRequired();
        builder.Property(w => w.UserUuid).IsRequired();
        builder.Property(w => w.WorkTypeUuid).IsRequired();
        builder.Property(w => w.LoggedOn).HasColumnType("date").IsRequired();
        builder.Property(w => w.Minutes).IsRequired();
        builder.Property(w => w.Description).HasMaxLength(2_000);
        builder.Property(w => w.CreatedAt).IsRequired();

        // Suma wpisów zgłoszenia (panel pól, TIME-002) i lista karty idą po tym indeksie.
        builder.HasIndex(w => w.IssueUuid);

        // Agregacja po łańcuchu `realizuje` (TIME-004) łączy się z `issue_work_log` po
        // zgłoszeniu wykonawczym — ten sam indeks obsługuje oba zapytania.
        builder.HasIndex(w => new { w.IssueUuid, w.LoggedOn });
    }
}
