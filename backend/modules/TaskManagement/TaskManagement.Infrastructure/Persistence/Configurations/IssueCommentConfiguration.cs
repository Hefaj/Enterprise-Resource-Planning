using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>
/// Mapowanie komentarza zgłoszenia.
///
/// <para><b>Kaskada po zgłoszeniu, ale NIE po rodzicu wątku.</b> Komentarz ginie razem ze
/// zgłoszeniem, bo poza nim nie ma sensu. Odpowiedzi natomiast nie znikają z usunięciem
/// komentarza głównego — usunięcie jest miękkie (<see cref="IssueComment.Remove"/>), więc
/// twarda kaskada po <c>parent_uuid</c> nigdy by się nie odpaliła, a gdyby ktoś kiedyś dodał
/// twarde kasowanie, zabrałaby cudze wypowiedzi. <c>Restrict</c> zamienia taki błąd
/// w wyjątek zamiast w cichą utratę danych.</para>
/// </summary>
public sealed class IssueCommentConfiguration : IEntityTypeConfiguration<IssueComment>
{
    public void Configure(EntityTypeBuilder<IssueComment> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue_comment");
        builder.HasKey(c => c.Uuid);

        builder.Property(c => c.IssueUuid).IsRequired();
        builder.Property(c => c.Body).HasMaxLength(IssueComment.MaxBodyLength).IsRequired();
        builder.Property(c => c.OriginalBody).HasMaxLength(IssueComment.MaxBodyLength);
        builder.Property(c => c.AuthorUuid).IsRequired();
        builder.Property(c => c.CreatedAt).IsRequired();

        builder.Ignore(c => c.IsRemoved);

        // Wątek czyta się zawsze w całości i zawsze chronologicznie — indeks pokrywa dokładnie
        // to jedno zapytanie karty zgłoszenia.
        builder.HasIndex(c => new { c.IssueUuid, c.CreatedAt });

        builder.HasOne<Issue>()
            .WithMany()
            .HasForeignKey(c => c.IssueUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<IssueComment>()
            .WithMany()
            .HasForeignKey(c => c.ParentUuid)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
