using Erp.BuildingBlocks.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Erp.BuildingBlocks.Jobs;

/// <summary>Mapowanie EF dla <see cref="Job"/>.</summary>
public sealed class JobConfiguration : IEntityTypeConfiguration<Job>
{
    public void Configure(EntityTypeBuilder<Job> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("job");
        builder.HasKey(j => j.Uuid);

        builder.Property(j => j.CommandType).HasMaxLength(256).IsRequired();
        builder.Property(j => j.CommandJson).HasColumnType("jsonb");
        builder.Property(j => j.QueueId).HasMaxLength(128);
        builder.Property(j => j.UserId).HasMaxLength(128);
        builder.Property(j => j.ClientId).HasMaxLength(128);
        builder.Property(j => j.UiMetadata).HasColumnType("jsonb");
        builder.Property(j => j.ResultRef).HasMaxLength(256);

        // Status jako liczba, nie tekst: kolejność wartości jest częścią kontraktu
        // (JobStatus w Erp.BuildingBlocks.Contracts), a filtrowanie po int jest tańsze.
        builder.Property(j => j.Status).HasConversion<int>();

        // Kind tak samo. Wartość domyślna Map (0) sprawia, że wiersze sprzed dodania kolumny
        // pozostają poprawne — wszystkie wcześniejsze zadania były map-owe.
        builder.Property(j => j.Kind).HasConversion<int>().HasDefaultValue(JobKind.Map);

        // Dokładnie ten predykat, którym runner szuka pracy — bez tego indeksu każde
        // odpytanie kolejki skanowałoby całą historię zadań, która rośnie w nieskończoność.
        // `Kind` jest w kluczu jako pierwszy, bo każdy runner filtruje po nim na sztywno.
        builder.HasIndex(j => new { j.Kind, j.Status, j.CreatedAt });

        // Frontend filtruje listę zadań po użytkowniku i po modalu (queueID).
        builder.HasIndex(j => j.UserId);
        builder.HasIndex(j => j.QueueId);

        builder.HasMany(j => j.Items)
            .WithOne()
            .HasForeignKey(i => i.JobUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata
            .FindNavigation(nameof(Job.Items))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>Mapowanie EF dla <see cref="JobItem"/>.</summary>
public sealed class JobItemConfiguration : IEntityTypeConfiguration<JobItem>
{
    public void Configure(EntityTypeBuilder<JobItem> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("job_item");
        builder.HasKey(i => i.Uuid);

        builder.Property(i => i.Status).HasConversion<int>();
        builder.Property(i => i.ErrorCode).HasMaxLength(128);
        builder.Property(i => i.ErrorMessage).HasMaxLength(2048);
        builder.Property(i => i.CommandJson).HasColumnType("jsonb");

        // Zapytanie runnera: „następne N oczekujących elementów tego zadania, wg kolejności”.
        // Przy zadaniu na 50 tys. elementów bez tego indeksu każdy z ~100 chunków
        // przeglądałby całą tabelę elementów.
        builder.HasIndex(i => new { i.JobUuid, i.Status, i.Ordinal });

        // Raport „co się nie udało w tym zadaniu” grupowany po kodzie błędu.
        builder.HasIndex(i => new { i.JobUuid, i.ErrorCode });
    }
}
