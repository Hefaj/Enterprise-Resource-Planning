using Catalog.Domain.Categories;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;

namespace Catalog.Infrastructure.Persistence.Configurations;

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
