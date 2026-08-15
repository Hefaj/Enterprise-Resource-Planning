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

        // Sygnatura duplikatu: ten sam model + ten sam komplet kategorii. Reguła dotyczy zbioru
        // wierszy z `product_category`, więc zwykły indeks złożony po kolumnach produktu jej nie
        // wyrazi — stąd skrót liczony w agregacie (Product.ComputeDuplicateKey) i indeks po nim.
        //
        // Indeks jest jedyną GWARANCJĄ, że duplikat nie powstanie; walidacja wsadowa
        // (ProductDuplicateRule) to tylko jego szybka zapowiedź, bo między pre-checkiem
        // a wykonaniem chunka przez BulkCommandRunner mija dowolnie dużo czasu.
        //
        // Filtr, nie pełny indeks: produkty bez modelu mają duplicate_key = NULL i świadomie
        // nie uczestniczą w regule. Postgres i tak traktuje NULL-e jako różne, ale filtr trzyma
        // poza indeksem wiersze, które nigdy nie mogą kolidować.
        builder.Property(p => p.DuplicateKey).HasMaxLength(64);
        builder.HasIndex(p => p.DuplicateKey)
            .IsUnique()
            .HasFilter("duplicate_key IS NOT NULL");

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

    // ── Dlaczego HasMany, a nie OwnsMany ─────────────────────────────────────────────────
    //
    // Te tabele wyglądają na podręcznikowy przypadek typu owned: nikt nie ładuje ani nie edytuje
    // „przypisania do kategorii” samodzielnie, żyje ono i umiera z produktem. Mapowanie owned
    // ma jednak konsekwencję, która przekreśla tę elegancję: EF nie śledzi tożsamości dzieci
    // kolekcji owned pomiędzy przebiegami wykrywania zmian. Przy zmianie kompletu powiązań
    // istniejącego produktu paruje nowo utworzone obiekty z już śledzonymi wpisami i zamiast
    // INSERT-a emituje UPDATE wiersza, którego w bazie nie ma:
    //
    //     DELETE FROM product_category WHERE uuid = @p13;
    //     UPDATE product_category SET category_uuid = @p14 WHERE uuid = @p16;  -- 0 wierszy
    //
    // Przy kluczu złożonym z danych kończyło się to CICHĄ utratą przypisań (EF nie potrafi
    // zaktualizować kolumn klucza głównego, więc po prostu nie robił nic, a SaveChanges
    // zgłaszał sukces). Po dodaniu klucza technicznego ten sam mechanizm daje przynajmniej
    // głośny `concurrency_conflict`, ale zapis nadal nie działa.
    //
    // Zwykła relacja jeden-do-wielu rozwiązuje to u źródła: dzieci są normalnymi encjami
    // z własną tożsamością, więc nowy obiekt trafia do stanu `Added` i powstaje INSERT.
    // Granica agregatu nie zmienia się ani trochę — nadal nie ma dla nich DbSet-u, nadal
    // wchodzi się do nich wyłącznie przez `Product`, a `OnDelete(Cascade)` utrzymuje
    // regułę „dziecko nie istnieje bez produktu”. Zmienia się wyłącznie sposób, w jaki EF
    // rozpoznaje zmiany.
    //
    // Uwaga przy zmianach: `AggregateChangeScanner` przypisuje zmienione dziecko do agregatu
    // przez `FindOwnership()`, które dla encji nie-owned zwraca null. Ma z tego powodu drugą
    // ścieżkę — po kluczu obcym wskazującym korzeń agregatu. Bez niej zmiana samych kategorii
    // przestałaby rozgłaszać `AggregateChanged` po SignalR.

    private static void ConfigureCategories(EntityTypeBuilder<Product> builder)
    {
        builder.HasMany<ProductCategoryLink>("_categories")
            .WithOne()
            .HasForeignKey(l => l.ProductUuid)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureMultimedia(EntityTypeBuilder<Product> builder)
    {
        builder.HasMany<ProductMultimediaLink>("_multimedia")
            .WithOne()
            .HasForeignKey(l => l.ProductUuid)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureWarranties(EntityTypeBuilder<Product> builder)
    {
        builder.HasMany<ProductWarranty>("_warranties")
            .WithOne()
            .HasForeignKey(w => w.ProductUuid)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
