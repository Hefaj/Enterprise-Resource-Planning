using Catalog.Domain.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie gwarancji przypisanych do produktu.</summary>
public sealed class ProductWarrantyConfiguration : IEntityTypeConfiguration<ProductWarranty>
{
    public void Configure(EntityTypeBuilder<ProductWarranty> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("product_warranty");
        builder.HasKey(w => w.Uuid);

        // Klucz nadaje baza. To NIE jest kosmetyka: gdyby wartość ustawiał konstruktor,
        // EF uznawałby każde nowe powiązanie za wiersz już istniejący i planował UPDATE
        // zamiast INSERT-a — patrz komentarz przy ProductCategoryLink w domenie.
        builder.Property(w => w.Uuid)
            .ValueGeneratedOnAdd()
            .HasDefaultValueSql("gen_random_uuid()");
        builder.HasIndex(w => new { w.ProductUuid, w.WarrantyUuid }).IsUnique();
        builder.HasIndex(w => w.WarrantyUuid);
    }
}
