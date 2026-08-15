using Catalog.Domain.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie powiązań produktu z multimediami.</summary>
public sealed class ProductMultimediaLinkConfiguration : IEntityTypeConfiguration<ProductMultimediaLink>
{
    public void Configure(EntityTypeBuilder<ProductMultimediaLink> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("product_multimedia");
        builder.HasKey(l => l.Uuid);

        // Klucz nadaje baza. To NIE jest kosmetyka: gdyby wartość ustawiał konstruktor,
        // EF uznawałby każde nowe powiązanie za wiersz już istniejący i planował UPDATE
        // zamiast INSERT-a — patrz komentarz przy ProductCategoryLink w domenie.
        builder.Property(l => l.Uuid)
            .ValueGeneratedOnAdd()
            .HasDefaultValueSql("gen_random_uuid()");
        builder.HasIndex(l => new { l.ProductUuid, l.MultimediaUuid }).IsUnique();
        builder.HasIndex(l => l.MultimediaUuid);
    }
}
