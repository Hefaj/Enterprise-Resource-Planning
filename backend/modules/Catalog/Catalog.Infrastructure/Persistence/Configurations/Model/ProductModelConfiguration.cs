using Catalog.Domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="ProductModel"/>.</summary>
public sealed class ProductModelConfiguration : IEntityTypeConfiguration<ProductModel>
{
    public void Configure(EntityTypeBuilder<ProductModel> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        // Tabela nazywa się `model`, bo tak brzmi pojęcie w kontrakcie API i w języku domeny;
        // rozjazd z nazwą klasy (ProductModel) jest świadomy i wyjaśniony przy samej klasie.
        builder.ToTable("model");
        builder.HasKey(m => m.Uuid);

        builder.Property(m => m.Name).HasMaxLength(512).IsRequired();
        builder.HasIndex(m => m.Name);
    }
}
