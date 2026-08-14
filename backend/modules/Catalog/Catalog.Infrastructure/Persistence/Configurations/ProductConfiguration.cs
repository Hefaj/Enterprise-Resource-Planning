using Catalog.Domain.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="Product"/> wraz z kolekcjami wewnętrznymi.</summary>
public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("product");
        builder.HasKey(p => p.Uuid);

        builder.Property(p => p.Name).HasMaxLength(512).IsRequired();
        builder.Property(p => p.Sku).HasMaxLength(64).IsRequired();
        builder.Property(p => p.Ean).HasMaxLength(32);
        builder.Property(p => p.Image).HasMaxLength(2048);
        builder.Property(p => p.AttrWeight).HasMaxLength(64);
        builder.Property(p => p.AttrColor).HasMaxLength(64);

        // Cena pieniężna: numeric(18,2). Typ zmiennoprzecinkowy dla kwot to klasyczne źródło
        // groszowych rozjazdów przy sumowaniu pozycji.
        builder.Property(p => p.Price).HasColumnType("numeric(18,2)");

        builder.Property(p => p.Status).HasConversion<int>();

        // Available jest właściwością wyliczaną z Status — nie ma jej w tabeli.
        builder.Ignore(p => p.Available);

        // SKU jest identyfikatorem handlowym; unikalność wymuszona w bazie, a nie tylko
        // w walidacji aplikacyjnej, bo dwie równoległe komendy przeszłyby walidację obie.
        builder.HasIndex(p => p.Sku).IsUnique();
        builder.HasIndex(p => p.Ean);
        builder.HasIndex(p => p.ModelUuid);

        // Sortowania dopuszczone przez searchProduct — bez indeksów każde sortowanie
        // po cenie czy dacie oznacza pełny skan przy 1500+ produktach i rośnie liniowo.
        builder.HasIndex(p => p.Name);
        builder.HasIndex(p => p.Price);
        builder.HasIndex(p => p.AvailableFrom);
        builder.HasIndex(p => p.Status);

        ConfigureCategories(builder);
        ConfigureMultimedia(builder);
        ConfigureWarranties(builder);

        // Kolekcje są prywatnymi polami — EF musi je czytać przez pole, nie przez właściwość
        // (właściwości publiczne zwracają projekcje tylko do odczytu).
        builder.Metadata.FindNavigation("_categories")?.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation("_multimedia")?.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation("_warranties")?.SetPropertyAccessMode(PropertyAccessMode.Field);

        // Publiczne właściwości kolekcji są WYŁĄCZNIE odczytową fasadą nad prywatnymi polami
        // (`CategoryUuids` rzutuje na Guid, `Warranties` opakowuje listę w AsReadOnly).
        // Bez tych trzech wpisów EF widzi dwie ścieżki do tych samych danych — pole i właściwość —
        // i albo próbuje zmapować je jako osobne relacje, albo w ogóle nie potrafi ich powiązać.
        builder.Ignore(p => p.CategoryUuids);
        builder.Ignore(p => p.MultimediaUuids);
        builder.Ignore(p => p.Warranties);
    }

    private static void ConfigureCategories(EntityTypeBuilder<Product> builder)
    {
        builder.OwnsMany<ProductCategoryLink>("_categories", link =>
        {
            link.ToTable("product_category");
            link.WithOwner().HasForeignKey(l => l.ProductUuid);
            link.HasKey(l => new { l.ProductUuid, l.CategoryUuid });

            // Filtr „produkty w tych kategoriach” idzie od strony kategorii — bez tego indeksu
            // filtrowanie po zaznaczeniu drzewa skanowałoby całą tabelę powiązań.
            link.HasIndex(l => l.CategoryUuid);
        });
    }

    private static void ConfigureMultimedia(EntityTypeBuilder<Product> builder)
    {
        builder.OwnsMany<ProductMultimediaLink>("_multimedia", link =>
        {
            link.ToTable("product_multimedia");
            link.WithOwner().HasForeignKey(l => l.ProductUuid);
            link.HasKey(l => new { l.ProductUuid, l.MultimediaUuid });
            link.HasIndex(l => l.MultimediaUuid);
        });
    }

    private static void ConfigureWarranties(EntityTypeBuilder<Product> builder)
    {
        builder.OwnsMany<ProductWarranty>("_warranties", warranty =>
        {
            warranty.ToTable("product_warranty");
            warranty.WithOwner().HasForeignKey(w => w.ProductUuid);
            warranty.HasKey(w => new { w.ProductUuid, w.WarrantyUuid });
            warranty.HasIndex(w => w.WarrantyUuid);
        });
    }
}
