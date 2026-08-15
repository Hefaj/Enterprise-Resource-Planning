using Catalog.Domain.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie przypisań produktu do kategorii.</summary>
public sealed class ProductCategoryLinkConfiguration : IEntityTypeConfiguration<ProductCategoryLink>
{
    public void Configure(EntityTypeBuilder<ProductCategoryLink> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("product_category");
        builder.HasKey(l => l.Uuid);

        // Klucz nadaje baza. To NIE jest kosmetyka: gdyby wartość ustawiał konstruktor,
        // EF uznawałby każde nowe powiązanie za wiersz już istniejący i planował UPDATE
        // zamiast INSERT-a — patrz komentarz przy ProductCategoryLink w domenie.
        builder.Property(l => l.Uuid)
            .ValueGeneratedOnAdd()
            .HasDefaultValueSql("gen_random_uuid()");

        // Faktyczna reguła biznesowa („produkt należy do kategorii najwyżej raz”) mieszka
        // w indeksie, a nie w kluczu głównym — patrz komentarz w ProductConfiguration.
        builder.HasIndex(l => new { l.ProductUuid, l.CategoryUuid }).IsUnique();

        // Filtr „produkty w tych kategoriach” idzie od strony kategorii — bez tego indeksu
        // filtrowanie po zaznaczeniu drzewa skanowałoby całą tabelę powiązań.
        builder.HasIndex(l => l.CategoryUuid);
    }
}
