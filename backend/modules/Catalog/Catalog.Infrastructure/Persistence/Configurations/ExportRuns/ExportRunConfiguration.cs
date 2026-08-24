using Catalog.Domain.ExportRuns;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Catalog.Infrastructure.Persistence.Configurations.ExportRuns;

/// <summary>Mapowanie agregatu <see cref="ExportRun"/>.</summary>
public sealed class ExportRunConfiguration : IEntityTypeConfiguration<ExportRun>
{
    public void Configure(EntityTypeBuilder<ExportRun> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("export_run");
        builder.HasKey(r => r.Uuid);

        builder.Property(r => r.Format).HasMaxLength(32).IsRequired();
        builder.Property(r => r.ParametersJson).HasColumnType("jsonb");
        builder.Property(r => r.ErrorCode).HasMaxLength(128);

        // Jak przy Job: status jako liczba, bo kolejność wartości jest kontraktem,
        // a filtrowanie po int jest tańsze niż po tekście.
        builder.Property(r => r.Status).HasConversion<int>();

        // Predykat, którym ExportRunner szuka pracy.
        builder.HasIndex(r => new { r.Status, r.CreatedAt });

        // Wyszukiwanie przebiegu po zadaniu, z którym jest związany — tą drogą idzie
        // pobranie artefaktu z poziomu powiadomienia (klient zna trackingID, nie uuid przebiegu).
        builder.HasIndex(r => r.JobUuid);
    }
}
