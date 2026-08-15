using System;
using Catalog.Domain.Attributes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Catalog.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie słownika definicji atrybutów wraz z listą dopuszczalnych wartości.</summary>
public sealed class AttributeDefinitionConfiguration : IEntityTypeConfiguration<AttributeDefinition>
{
    public void Configure(EntityTypeBuilder<AttributeDefinition> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("attribute_definition");
        builder.HasKey(a => a.Uuid);

        builder.Property(a => a.Code).HasMaxLength(64).IsRequired();
        builder.Property(a => a.Name).HasMaxLength(256).IsRequired();

        // Enumy jako int, nie string: wartość jest kontraktem danych, a nie etykietą —
        // przemianowanie pozycji w C# nie może unieważnić zapisanych wierszy.
        builder.Property(a => a.Kind).HasConversion<int>();
        builder.Property(a => a.DataType).HasConversion<int>();

        builder.HasIndex(a => a.Code).IsUnique();
        builder.HasIndex(a => a.SortOrder);

        // Zwykła relacja jeden-do-wielu, nie typ owned — dokładnie z powodów opisanych
        // w ProductConfiguration (EF nie śledzi tożsamości dzieci kolekcji owned między
        // przebiegami wykrywania zmian).
        builder.HasMany<AttributeOption>("_options")
            .WithOne()
            .HasForeignKey(o => o.AttributeUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata.FindNavigation("_options")?.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Ignore(a => a.Options);
    }
}

/// <summary>Mapowanie dopuszczalnych wartości atrybutu słownikowego.</summary>
public sealed class AttributeOptionConfiguration : IEntityTypeConfiguration<AttributeOption>
{
    public void Configure(EntityTypeBuilder<AttributeOption> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("attribute_option");
        builder.HasKey(o => o.Uuid);

        // Klucz nadaje agregat, a NIE baza — inaczej niż przy powiązaniach produktu.
        // Na ten identyfikator wskazuje `product_attribute_value.option_uuid`, więc musi być
        // trwały; patrz komentarz nad klasą AttributeOption.
        builder.Property(o => o.Uuid).ValueGeneratedNever();

        builder.Property(o => o.Code).HasMaxLength(64).IsRequired();
        builder.Property(o => o.Name).HasMaxLength(256).IsRequired();

        builder.HasIndex(o => new { o.AttributeUuid, o.Code }).IsUnique();
        builder.HasIndex(o => new { o.AttributeUuid, o.SortOrder });
    }
}
