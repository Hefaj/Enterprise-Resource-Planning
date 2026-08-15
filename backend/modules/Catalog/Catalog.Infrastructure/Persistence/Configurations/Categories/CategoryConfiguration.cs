using Catalog.Domain.Categories;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;

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
