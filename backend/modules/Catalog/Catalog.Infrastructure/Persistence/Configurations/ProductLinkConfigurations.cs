using Catalog.Domain.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Catalog.Infrastructure.Persistence.Configurations;

// Mapowanie bytów wewnętrznych agregatu Product. Są zwykłymi encjami, a nie typami owned —
// powód jest opisany w `ProductConfiguration`. Nadal NIE mają własnego `DbSet`: granicę
// agregatu trzyma to, że jedyną drogą do nich jest `Product`, a nie sposób mapowania.

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
