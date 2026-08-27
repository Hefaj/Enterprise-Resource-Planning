using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>
/// Mapowanie wpisu historii zgłoszenia.
///
/// <para><b>Rodzaj zapisany liczbą, nie tekstem.</b> Historia jest tabelą, która rośnie
/// najszybciej w całym module — jeden wiersz na każdą zmianę każdego pola. Nazwa rodzaju
/// w każdym wierszu byłaby powtarzanym tekstem tam, gdzie wystarczy <c>smallint</c>, a i tak
/// nie jest tym, co widzi użytkownik: zdanie składa front z kluczy tłumaczeń.</para>
///
/// <para>Indeks jest po <c>(issue_uuid, occurred_at DESC)</c>, bo historia ma dokładnie jednego
/// czytelnika: kartę zgłoszenia, od najnowszego wpisu.</para>
/// </summary>
public sealed class IssueActivityConfiguration : IEntityTypeConfiguration<IssueActivity>
{
    public void Configure(EntityTypeBuilder<IssueActivity> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue_activity");
        builder.HasKey(a => a.Uuid);

        builder.Property(a => a.IssueUuid).IsRequired();
        builder.Property(a => a.Kind).HasConversion<short>().IsRequired();
        builder.Property(a => a.FieldCode).HasMaxLength(64);
        builder.Property(a => a.OldValue).HasMaxLength(IssueActivity.MaxValueLength);
        builder.Property(a => a.NewValue).HasMaxLength(IssueActivity.MaxValueLength);
        builder.Property(a => a.ActorUuid).IsRequired();
        builder.Property(a => a.CorrelationId).IsRequired();
        builder.Property(a => a.OccurredAt).IsRequired();

        builder.HasIndex(a => new { a.IssueUuid, a.OccurredAt })
            .IsDescending(false, true);

        builder.HasOne<Issue>()
            .WithMany()
            .HasForeignKey(a => a.IssueUuid)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
