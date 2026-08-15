using Catalog.Domain.Warranties;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="Warranty"/>.</summary>
public sealed class WarrantyConfiguration : IEntityTypeConfiguration<Warranty>
{
    public void Configure(EntityTypeBuilder<Warranty> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("warranty");
        builder.HasKey(w => w.Uuid);

        builder.Property(w => w.Name).HasMaxLength(512).IsRequired();
        builder.Property(w => w.Description).HasMaxLength(4096);

        builder.HasIndex(w => w.Name);
    }
}
