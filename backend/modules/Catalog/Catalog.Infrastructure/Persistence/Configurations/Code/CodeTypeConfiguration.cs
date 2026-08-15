using System;
using Catalog.Domain.Codes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie słownika typów kodów.</summary>
public sealed class CodeTypeConfiguration : IEntityTypeConfiguration<CodeType>
{
    public void Configure(EntityTypeBuilder<CodeType> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("code_type");
        builder.HasKey(t => t.Uuid);

        builder.Property(t => t.Symbol).HasMaxLength(64).IsRequired();
        builder.Property(t => t.Name).HasMaxLength(256).IsRequired();
        builder.Property(t => t.Pattern).HasMaxLength(512);

        // Symbol jest tym, po czym typ rozpoznają integracje — unikalność musi pilnować baza,
        // bo dwie równoległe komendy przeszłyby walidację aplikacyjną obie.
        builder.HasIndex(t => t.Symbol).IsUnique();
        builder.HasIndex(t => t.SortOrder);
    }
}
