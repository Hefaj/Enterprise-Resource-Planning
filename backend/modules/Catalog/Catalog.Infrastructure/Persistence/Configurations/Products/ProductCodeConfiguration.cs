using System;
using Catalog.Domain.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie kodów nadanych produktowi.</summary>
public sealed class ProductCodeConfiguration : IEntityTypeConfiguration<ProductCode>
{
    public void Configure(EntityTypeBuilder<ProductCode> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("product_code");
        builder.HasKey(c => c.Uuid);

        // Klucz nadaje baza. To NIE jest kosmetyka: gdyby wartość ustawiał konstruktor,
        // EF uznawałby każdy nowy kod za wiersz już istniejący i planował UPDATE
        // zamiast INSERT-a — patrz komentarz przy ProductCategoryLink w domenie.
        builder.Property(c => c.Uuid)
            .ValueGeneratedOnAdd()
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(c => c.Value).HasMaxLength(128).IsRequired();
        builder.Property(c => c.UniqueKey).HasMaxLength(192);

        // Reguła unikalności zależy od WIERSZA SŁOWNIKA (CodeType.IsUnique), a nie od kolumn
        // tej tabeli, więc zwykły indeks po (typ, wartość) by jej nie wyraził — objąłby też
        // typy, które z natury się powtarzają. Stąd sygnatura wypełniana tylko dla typów
        // unikalnych i indeks częściowy po niej; patrz ProductCode.UniqueKey.
        //
        // Indeks jest jedyną GWARANCJĄ — walidacja aplikacyjna jest tylko jego zapowiedzią,
        // dokładnie tak samo jak przy `duplicate_key` produktu.
        builder.HasIndex(c => c.UniqueKey)
            .IsUnique()
            .HasFilter("unique_key IS NOT NULL");

        // Ten sam kod nie może być nadany produktowi dwa razy, niezależnie od unikalności typu.
        builder.HasIndex(c => new { c.ProductUuid, c.CodeTypeUuid, c.Value }).IsUnique();

        // Wyszukiwanie po fragmencie kodu (searchProduct.productCode) idzie od strony wartości.
        builder.HasIndex(c => c.Value);
        builder.HasIndex(c => c.CodeTypeUuid);
    }
}
