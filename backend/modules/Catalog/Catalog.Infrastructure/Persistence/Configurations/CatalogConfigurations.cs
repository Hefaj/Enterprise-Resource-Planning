using Catalog.Domain.Categories;
using Catalog.Domain.Models;
using Catalog.Domain.Multimedia;
using Catalog.Domain.Warranties;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="Category"/>.</summary>
public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("category");
        builder.HasKey(c => c.Uuid);

        builder.Property(c => c.Name).HasMaxLength(512).IsRequired();

        // Zapytanie „dzieci węzła X, stronicowane po nazwie” to podstawowa operacja
        // erp-tree w trybie server — indeks złożony obsługuje ją bez sortowania w pamięci.
        builder.HasIndex(c => new { c.ParentUuid, c.Name });

        // Wyszukiwanie po nazwie w całym drzewie (searchCategoryTree).
        builder.HasIndex(c => c.Name);
    }
}

/// <summary>Mapowanie tabeli domknięcia drzewa kategorii.</summary>
public sealed class CategoryClosureConfiguration : IEntityTypeConfiguration<CategoryClosureEntry>
{
    public void Configure(EntityTypeBuilder<CategoryClosureEntry> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("category_closure");

        // Klucz złożony (przodek, potomek) — para jest z definicji unikalna.
        builder.HasKey(e => new { e.AncestorUuid, e.DescendantUuid });

        // Dwa kierunki odpytywania, oba realne:
        //  - „potomkowie węzła” (rozwinięcie poddrzewa, zliczanie descendantCount) → po przodku,
        //  - „przodkowie węzła” (ścieżka do korzenia w searchCategoryTree) → po potomku.
        builder.HasIndex(e => new { e.AncestorUuid, e.Depth });
        builder.HasIndex(e => new { e.DescendantUuid, e.Depth });
    }
}

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

/// <summary>Mapowanie agregatu <see cref="MultimediaAsset"/>.</summary>
public sealed class MultimediaAssetConfiguration : IEntityTypeConfiguration<MultimediaAsset>
{
    public void Configure(EntityTypeBuilder<MultimediaAsset> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("multimedia");
        builder.HasKey(m => m.Uuid);

        builder.Property(m => m.FileName).HasMaxLength(512).IsRequired();
        builder.Property(m => m.MediaType).HasMaxLength(64).IsRequired();
        builder.Property(m => m.MimeType).HasMaxLength(128).IsRequired();
        builder.Property(m => m.ThumbnailUrl).HasMaxLength(2048);
        builder.Property(m => m.OriginalUrl).HasMaxLength(2048).IsRequired();

        builder.HasIndex(m => m.FileName);
        builder.HasIndex(m => m.CreatedAt);
    }
}

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
