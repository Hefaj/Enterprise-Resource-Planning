using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.FieldSchemes;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie schematu pól razem z definicjami — to jeden agregat, więc ładuje się
/// i zapisuje w całości.</summary>
public sealed class FieldSchemeConfiguration : IEntityTypeConfiguration<FieldScheme>
{
    public void Configure(EntityTypeBuilder<FieldScheme> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("field_scheme");
        builder.HasKey(s => s.Uuid);

        builder.Property(s => s.Name).HasMaxLength(256).IsRequired();
        builder.Property(s => s.IsSystem).IsRequired();

        builder.HasMany(s => s.Fields)
            .WithOne()
            .HasForeignKey(f => f.SchemeUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(s => s.Fields).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>
/// Mapowanie definicji pola.
///
/// <para>Dwa indeksy unikalne i oba niosą regułę ze <c>§6</c>: kod pola jest kluczem w jsonb
/// zgłoszenia, więc nie może się powtórzyć w schemacie, a slot jest kolumną, więc dwa pola
/// w jednym slocie to dwie wartości w jednej kolumnie. <b>Egzekwuje to indeks bazy, nie kod
/// aplikacji</b> — tak samo jak trzy niezmienniki międzyagregatowe tego modułu.</para>
/// </summary>
public sealed class FieldDefinitionConfiguration : IEntityTypeConfiguration<FieldDefinition>
{
    public void Configure(EntityTypeBuilder<FieldDefinition> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("field_definition");
        builder.HasKey(f => f.Uuid);

        builder.Property(f => f.SchemeUuid).IsRequired();
        builder.Property(f => f.Code).HasMaxLength(64).IsRequired();
        builder.Property(f => f.NameKey).HasMaxLength(256).IsRequired();
        builder.Property(f => f.DataType).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(f => f.Slot).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(f => f.OrderNo).IsRequired();
        builder.Property(f => f.IsRequired).IsRequired();

        builder.Property<List<string>>("_options")
            .HasColumnName("options")
            .HasColumnType("text[]")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .IsRequired();

        builder.Ignore(f => f.Options);
        builder.Ignore(f => f.IsSortable);

        builder.HasIndex(f => new { f.SchemeUuid, f.Code }).IsUnique();

        // Slot unikalny w schemacie, ale `None` wolno powtarzać dowolnie — to nie jest slot,
        // tylko jego brak. Stąd indeks częściowy, a nie zwykły unikalny.
        builder.HasIndex(f => new { f.SchemeUuid, f.Slot })
            .IsUnique()
            .HasFilter("slot <> 'None'");
    }
}
