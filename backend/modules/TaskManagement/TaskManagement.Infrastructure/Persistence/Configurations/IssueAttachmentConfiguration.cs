using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>
/// Mapowanie załącznika zgłoszenia.
///
/// <para><b>Kaskada na kluczu obcym jest tu mechanizmem sprzątania</b>, nie wygodą: usunięcie
/// zgłoszenia zabiera jego pliki w tej samej transakcji, więc nie ma stanu pośredniego,
/// w którym wiersz już nie istnieje, a obiekt w magazynie jeszcze tak. Bajty z magazynu zdejmuje
/// potem konsument zdarzenia — tą samą drogą co w Catalogu
/// (<c>docs/backend/media-storage.md</c> §4c).</para>
/// </summary>
public sealed class IssueAttachmentConfiguration : IEntityTypeConfiguration<IssueAttachment>
{
    public void Configure(EntityTypeBuilder<IssueAttachment> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue_attachment");
        builder.HasKey(a => a.Uuid);

        builder.Property(a => a.IssueUuid).IsRequired();
        builder.Property(a => a.ArtifactUuid).IsRequired();
        builder.Property(a => a.FileName).HasMaxLength(256).IsRequired();
        builder.Property(a => a.MimeType).HasMaxLength(128).IsRequired();
        builder.Property(a => a.FileSize).IsRequired();
        builder.Property(a => a.UploadedByUuid).IsRequired();
        builder.Property(a => a.CreatedAt).IsRequired();

        builder.Ignore(a => a.IsImage);

        builder.HasIndex(a => a.IssueUuid);

        // Jeden obiekt w magazynie należy do dokładnie jednego załącznika — inaczej promocja
        // z poczekalni wykonana dwa razy dałaby dwa wiersze wskazujące ten sam plik i pierwsze
        // kaskadowe usunięcie zabrałoby bajty spod drugiego.
        builder.HasIndex(a => a.ArtifactUuid).IsUnique();

        builder.HasOne<Issue>()
            .WithMany()
            .HasForeignKey(a => a.IssueUuid)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
