using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Issues;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>
/// Mapowanie krawędzi powiązania.
///
/// <para>Unikalność po trójce (źródło, cel, typ) egzekwuje <b>indeks bazy</b>: dwie równoległe
/// próby dopięcia tej samej blokady to zwykły wyścig, a nie rzadkość — tak samo jak przy
/// członkostwie w projekcie. Ta sama para zgłoszeń może być jednak powiązana <b>różnymi</b>
/// typami naraz („blokuje" i „dotyczy"), więc typ jest częścią klucza naturalnego.</para>
///
/// <para>Oba klucze obce kaskadują: usunięcie zgłoszenia zabiera jego krawędzie, bo krawędź
/// bez jednego końca nie znaczy nic. To także powód, dla którego skaner zmian nie rozstrzygnie
/// właściciela tej encji sam — ma DWA klucze obce do korzeni agregatów — i dlatego
/// <see cref="IssueLink"/> jest własnym korzeniem z własną sygnaturą.</para>
/// </summary>
public sealed class IssueLinkConfiguration : IEntityTypeConfiguration<IssueLink>
{
    public void Configure(EntityTypeBuilder<IssueLink> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue_link");
        builder.HasKey(l => l.Uuid);

        builder.Property(l => l.SourceUuid).IsRequired();
        builder.Property(l => l.TargetUuid).IsRequired();
        builder.Property(l => l.Type).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(l => l.CreatedBy).IsRequired();
        builder.Property(l => l.CreatedAt).IsRequired();

        builder.HasIndex(l => new { l.SourceUuid, l.TargetUuid, l.Type }).IsUnique();

        // Pasek powiązań na karcie pyta z obu stron naraz, więc oba kierunki mają swój indeks.
        builder.HasIndex(l => l.TargetUuid);

        builder.HasOne<Issue>()
            .WithMany()
            .HasForeignKey(l => l.SourceUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Issue>()
            .WithMany()
            .HasForeignKey(l => l.TargetUuid)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
