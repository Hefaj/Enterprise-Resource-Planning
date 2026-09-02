using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.SavedViews;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="SavedView"/> (VIEW-001).</summary>
public sealed class SavedViewConfiguration : IEntityTypeConfiguration<SavedView>
{
    public void Configure(EntityTypeBuilder<SavedView> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("saved_view");
        builder.HasKey(v => v.Uuid);

        builder.Property(v => v.OwnerUserUuid).IsRequired();
        builder.Property(v => v.ProjectUuid);
        builder.Property(v => v.Name).HasMaxLength(128).IsRequired();

        // Opaque dla backendu (patrz komentarz przy agregacie) — zwykły tekst, nie `jsonb`:
        // nikt tu nie pyta o klucz wewnątrz, więc binarna postać nie daje żadnej korzyści.
        builder.Property(v => v.FilterJson).HasColumnType("text").IsRequired();
        builder.Property(v => v.SortJson).HasColumnType("text");

        builder.Property(v => v.Mode).HasConversion<string>().HasMaxLength(16).IsRequired();

        // Kody kolumn — lista tekstów bez własnych atrybutów, ten sam wzorzec co
        // `Issue.PreviousKeys` (`IssueConfiguration`): tablica Postgresa, nie tabela podrzędna.
        // Mapowanie idzie po polu prywatnym — `Columns` na zewnątrz jest `IReadOnlyList<string>`,
        // którego EF/Npgsql nie mapuje wprost na `text[]`.
        builder.Property<List<string>>("_columns")
            .HasColumnName("columns")
            .HasColumnType("text[]")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .IsRequired();

        builder.Ignore(v => v.Columns);

        // Widoczność listy widoków idzie po właścicielu (własne) i po projekcie (udostępnione) —
        // patrz `SavedViewQueries.SearchAsync`.
        builder.HasIndex(v => v.OwnerUserUuid);
        builder.HasIndex(v => v.ProjectUuid);
    }
}
