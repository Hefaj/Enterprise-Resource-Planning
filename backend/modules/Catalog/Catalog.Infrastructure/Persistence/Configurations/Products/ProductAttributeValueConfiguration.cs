using System;
using Catalog.Domain.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie wartości atrybutów produktu.</summary>
public sealed class ProductAttributeValueConfiguration : IEntityTypeConfiguration<ProductAttributeValue>
{
    public void Configure(EntityTypeBuilder<ProductAttributeValue> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("product_attribute_value", table => table.HasCheckConstraint(
            "ck_product_attribute_value_payload",
            // Dokładnie jedna gałąź wartości. Ograniczenie jest w bazie, a nie tylko w fabrykach
            // ProductAttributeAssignment, bo model domenowy nie jest jedyną drogą do tej tabeli —
            // seed, import i ręczna poprawka w SQL-u omijają go w całości.
            """
            (CASE WHEN option_uuid IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN multimedia_uuid IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN value_text IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN value_number IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN value_boolean IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN value_date IS NOT NULL THEN 1 ELSE 0 END) = 1
            """));

        builder.HasKey(v => v.Uuid);

        // Klucz nadaje baza — patrz komentarz przy ProductCategoryLink w domenie.
        builder.Property(v => v.Uuid)
            .ValueGeneratedOnAdd()
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(v => v.Kind).HasConversion<int>();

        builder.Property(v => v.ValueText).HasMaxLength(4096);

        // numeric(28,10), nie double: atrybut liczbowy bywa ceną jednostkową albo wymiarem
        // z dokładnością do mikrometra, a typ zmiennoprzecinkowy gubi je tak samo jak kwoty.
        builder.Property(v => v.ValueNumber).HasColumnType("numeric(28,10)");

        // Atrybut jednowartościowy występuje przy produkcie najwyżej raz. Filtr po skopiowanej
        // fladze, bo indeks nie zajrzy do `attribute_definition` — patrz komentarz przy
        // ProductAttributeValue.IsMultiValue.
        builder.HasIndex(v => new { v.ProductUuid, v.AttributeUuid })
            .IsUnique()
            .HasFilter("is_multi_value = false")
            .HasDatabaseName("ix_product_attribute_value_single");

        builder.HasIndex(v => new { v.ProductUuid, v.SortOrder });

        // Filtry „produkty o tym kolorze” / „waga powyżej” idą od strony atrybutu, nie produktu.
        builder.HasIndex(v => v.OptionUuid);
        builder.HasIndex(v => new { v.AttributeUuid, v.ValueNumber });
        builder.HasIndex(v => new { v.AttributeUuid, v.ValueDate });
        builder.HasIndex(v => v.MultimediaUuid);
    }
}
