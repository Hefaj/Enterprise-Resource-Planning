using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TaskManagement.Domain.IssueTypes;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Resolutions;
using TaskManagement.Domain.Workflow;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie agregatu <see cref="Issue"/>.</summary>
public sealed class IssueConfiguration : IEntityTypeConfiguration<Issue>
{
    private static readonly JsonSerializerOptions CustomFieldsJson = new(JsonSerializerDefaults.Web);

    private static readonly ValueConverter<Dictionary<string, string>, string> CustomFieldsConverter = new(
        value => JsonSerializer.Serialize(value, CustomFieldsJson),
        json => JsonSerializer.Deserialize<Dictionary<string, string>>(json, CustomFieldsJson)
                ?? new Dictionary<string, string>());

    /// <summary>
    /// Porównywanie po wartości i <b>kopia przy migawce</b>. Bez tego EF trzymałby referencję
    /// do tego samego słownika, co agregat, i wykrywanie zmian nigdy nie zobaczyłoby różnicy —
    /// zapis pól niestandardowych po cichu nie generowałby UPDATE-a.
    /// </summary>
    private static readonly ValueComparer<Dictionary<string, string>> CustomFieldsComparer = new(
        (left, right) => left != null && right != null && left.Count == right.Count && !left.Except(right).Any(),
        value => value.Aggregate(
            0,
            (hash, pair) => HashCode.Combine(
                hash,
                pair.Key.GetHashCode(StringComparison.Ordinal),
                pair.Value.GetHashCode(StringComparison.Ordinal))),
        value => new Dictionary<string, string>(value, StringComparer.Ordinal));

    public void Configure(EntityTypeBuilder<Issue> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue");
        builder.HasKey(i => i.Uuid);

        builder.Property(i => i.ProjectUuid).IsRequired();

        // Typ steruje hierarchią (`Issue.SetParent`) i opcjonalnie zawęża konfigurację —
        // wymagany od tej migracji, dane sprzed niej są do wyrzucenia (TYP-001).
        builder.Property(i => i.TypeUuid).IsRequired();

        builder.Property(i => i.Key).HasMaxLength(32).IsRequired();
        builder.Property(i => i.Title).HasMaxLength(512).IsRequired();
        builder.Property(i => i.Description);
        builder.Property(i => i.Priority).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(i => i.StateUuid).IsRequired();

        // Duplikat `WorkflowState.Category` — patrz komentarz przy właściwości. Istnieje
        // wyłącznie po to, żeby dało się założyć filtrowany indeks pod skan terminów (faza 5),
        // bo Postgres nie umie indeksu częściowego odwołującego się do innej tabeli.
        builder.Property(i => i.StateCategory).HasConversion<string>().HasMaxLength(16).IsRequired();

        builder.Property(i => i.ReporterUuid).IsRequired();
        builder.Property(i => i.IsRestricted).IsRequired();
        builder.Property(i => i.DerivedDeliveryState).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(i => i.LastOverdueNotifiedAt);
        builder.Property(i => i.EstimateMinutes);
        builder.Property(i => i.CreatedAt).IsRequired();
        builder.Property(i => i.UpdatedAt).IsRequired();

        // Klucze historyczne to lista tekstów, nie tabela podrzędna: nie mają własnych atrybutów,
        // nikt po nich nie sortuje, a jedyne zapytanie brzmi „czy zawiera ten klucz”.
        builder.Property<List<string>>("_previousKeys")
            .HasColumnName("previous_keys")
            .HasColumnType("text[]")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .IsRequired();

        builder.Ignore(i => i.PreviousKeys);

        // Wartości pól niestandardowych — źródło prawdy. `jsonb`, nie `json`: pytamy o klucz
        // (`jsonb_exists` w sondzie zajętości pola), a to wymaga postaci binarnej.
        // Konwerter jest tu ŚWIADOMIE, zamiast globalnego `EnableDynamicJson()` na źródle
        // danych. Npgsql nie mapuje słownika na jsonb bez tego opt-inu, a włączenie go dotyczy
        // całego fundamentu, opiera się na refleksji i psuje publikację AOT — czyli globalna
        // zmiana dla jednej kolumny w jednym module. Serializacja jest tu bezpieczna, bo
        // wartości są już w postaci kanonicznej (same napisy).
        builder.Property<Dictionary<string, string>>("_customFields")
            .HasColumnName("custom_fields")
            .HasColumnType("jsonb")
            .HasConversion(CustomFieldsConverter, CustomFieldsComparer)
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            // Domyślna pusta mapa, a nie NULL: zgłoszenia sprzed tej migracji muszą dostać
            // wartość w kolumnie NOT NULL, a „brak pól niestandardowych" to pusty obiekt,
            // nie brak danych — zapytania nie muszą wtedy rozróżniać tych dwóch przypadków.
            .HasDefaultValueSql("'{}'::jsonb")
            .IsRequired();

        builder.Ignore(i => i.CustomFields);

        // ── Sloty sortowalne ──
        //
        // Duplikat wartości sortowalnych i filtrowalnych z `custom_fields`. Indeksy zakładamy
        // ZŁOŻONE z `project_uuid`, a nie częściowe per projekt jak w DMS: indeks częściowy
        // wymaga uuid projektu w treści DDL, czyli tworzenia indeksu przy zakładaniu projektu.
        // To byłby DDL wykonywany komendą aplikacyjną, wbrew regule „migracja jest krokiem
        // wdrożenia" (docs/backend/production.md). Selektywność jest ta sama — pierwszą kolumną
        // indeksu jest projekt — a koszt to jeden indeks więcej na slot, nie jeden na projekt.
        builder.Property(i => i.Num1).HasColumnName("num_1");
        builder.Property(i => i.Num2).HasColumnName("num_2");
        builder.Property(i => i.Num3).HasColumnName("num_3");
        builder.Property(i => i.Num4).HasColumnName("num_4");
        builder.Property(i => i.Text1).HasColumnName("text_1").HasMaxLength(512);
        builder.Property(i => i.Text2).HasColumnName("text_2").HasMaxLength(512);
        builder.Property(i => i.Text3).HasColumnName("text_3").HasMaxLength(512);
        builder.Property(i => i.Text4).HasColumnName("text_4").HasMaxLength(512);
        builder.Property(i => i.Date1).HasColumnName("date_1");
        builder.Property(i => i.Date2).HasColumnName("date_2");
        builder.Property(i => i.Date3).HasColumnName("date_3");
        builder.Property(i => i.Date4).HasColumnName("date_4");
        builder.Property(i => i.User1).HasColumnName("user_1");
        builder.Property(i => i.User2).HasColumnName("user_2");

        // Indeksujemy wyłącznie pierwsze sloty każdego typu. Czternaście indeksów na najgorętszej
        // tabeli modułu kosztowałoby przy każdym zapisie zgłoszenia, a pola dalsze niż pierwsze
        // dwa w praktyce służą wyświetlaniu, nie sortowaniu. Doindeksowanie kolejnego slotu to
        // jedna migracja i decyzja podjęta na danych, a nie z góry.
        builder.HasIndex(i => new { i.ProjectUuid, i.Num1 });
        builder.HasIndex(i => new { i.ProjectUuid, i.Num2 });
        builder.HasIndex(i => new { i.ProjectUuid, i.Text1 });
        builder.HasIndex(i => new { i.ProjectUuid, i.Text2 });
        builder.HasIndex(i => new { i.ProjectUuid, i.Date1 });
        builder.HasIndex(i => new { i.ProjectUuid, i.Date2 });
        builder.HasIndex(i => new { i.ProjectUuid, i.User1 });
        builder.HasIndex(i => new { i.ProjectUuid, i.User2 });

        // Niezmiennik „klucz zgłoszenia jest unikalny globalnie” egzekwuje INDEKS BAZY,
        // nie kod aplikacji — dokładnie jak „dokument w jednym obiegu” w DMS
        // (docs/backend/task-management.md §3).
        builder.HasIndex(i => i.Key).IsUnique();

        builder.HasIndex(i => new { i.ProjectUuid, i.StateUuid });
        builder.HasIndex(i => i.AssigneeUuid);
        builder.HasIndex(i => i.ReporterUuid);

        // NFR-003: sortowanie domyślne listy (bez wybranego pola) jest po tej krotce (patrz
        // `IssueQueries.ApplySorting`). Bez wspierającego indeksu Postgres robi Seq Scan +
        // Sort całej tabeli przed odcięciem strony — przy 200 tys. zgłoszeń to Seq Scan
        // podnosi koszt na tyle, że JIT się włącza i sam narzuca ~190ms kosztu kompilacji,
        // zamiast pomóc (zmierzone przy weryfikacji fazy 6, zob. PLAN-task-management.md §4.6).
        // Z tym indeksem odczyt pierwszej strony jest odczytem wstecznym po indeksie, nie
        // skanem tabeli — koszt przestaje zależeć od liczby zgłoszeń.
        builder.HasIndex(i => new { i.CreatedAt, i.Uuid })
            .IsDescending(true, false);

        // Skan terminów (faza 5) idzie po tym indeksie, nie po wpisie harmonogramu per zgłoszenie —
        // rozdzielczość jest dzienna, więc drugi mechanizm z DMS-u byłby kosztem bez zysku (§9.3).
        // Filtrowany: zgłoszenia już zamknięte nie mają terminu, o który skan miałby pytać —
        // `state_category` jest duplikatem właśnie po to, żeby ten `HasFilter` mógł istnieć.
        builder.HasIndex(i => i.DueAt)
            .HasFilter($"state_category <> '{nameof(WorkflowStateCategory.Done)}'");

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(i => i.ProjectUuid)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<IssueType>()
            .WithMany()
            .HasForeignKey(i => i.TypeUuid)
            .OnDelete(DeleteBehavior.Restrict);

        // Filtr „zgłoszenia typu X w projekcie Y” (kolumna typu na liście, modal tworzenia)
        // idzie po tym indeksie.
        builder.HasIndex(i => new { i.ProjectUuid, i.TypeUuid });

        // Rodzic bez klucza obcego do samego siebie z kaskadą: usunięcie epiku nie może
        // wykasować podzadań po cichu. Hierarchię wypełnia faza 4.
        builder.HasIndex(i => i.ParentUuid);

        builder.HasMany(i => i.Watchers)
            .WithOne()
            .HasForeignKey(w => w.IssueUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(i => i.Watchers).UsePropertyAccessMode(PropertyAccessMode.Field);

        // Brak kaskady i brak `SetNull` na usunięciu rozwiązania — rozwiązania systemowe
        // (ISS-007) nigdy nie znikają, a te projektowe TAG-003/edytor fazy 7 najpierw
        // przepięcie zgłoszeń, potem usunięcie (ten sam wzorzec co `IssueTypeInUseRule`).
        builder.HasOne<Resolution>()
            .WithMany()
            .HasForeignKey(i => i.ResolutionUuid)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(i => i.Tags)
            .WithOne()
            .HasForeignKey(t => t.IssueUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(i => i.Tags).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(i => i.ExternalLinks)
            .WithOne()
            .HasForeignKey(l => l.IssueUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(i => i.ExternalLinks).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>Mapowanie przypisania tagu — tabela `issue_tag` (TAG-001 AC1). Unikalność po parze
/// (zgłoszenie, tag) jest w bazie, wzorem <see cref="IssueWatcherConfiguration"/>.</summary>
public sealed class IssueTagConfiguration : IEntityTypeConfiguration<IssueTag>
{
    public void Configure(EntityTypeBuilder<IssueTag> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue_tag");
        builder.HasKey(t => t.Uuid);

        // Patrz komentarz przy `IssueWatcherConfiguration.Uuid` — sam mechanizm, sam powód.
        builder.Property(t => t.Uuid).ValueGeneratedNever();

        builder.Property(t => t.IssueUuid).IsRequired();
        builder.Property(t => t.TagUuid).IsRequired();

        builder.HasIndex(t => new { t.IssueUuid, t.TagUuid }).IsUnique();
        builder.HasIndex(t => t.TagUuid);
    }
}

/// <summary>Mapowanie linku zewnętrznego (API-005) — tabela <c>issue_external_link</c>. Bez
/// unikalności po adresie — patrz komentarz przy <see cref="Issue.AddExternalLink"/>.</summary>
public sealed class IssueExternalLinkConfiguration : IEntityTypeConfiguration<IssueExternalLink>
{
    public void Configure(EntityTypeBuilder<IssueExternalLink> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue_external_link");
        builder.HasKey(l => l.Uuid);

        // Patrz komentarz przy IssueWatcherConfiguration.Uuid — sam mechanizm, sam powód.
        builder.Property(l => l.Uuid).ValueGeneratedNever();

        builder.Property(l => l.IssueUuid).IsRequired();
        builder.Property(l => l.Url).HasMaxLength(2048).IsRequired();
        builder.Property(l => l.Label).HasMaxLength(256).IsRequired();

        builder.HasIndex(l => l.IssueUuid);
    }
}

/// <summary>Mapowanie obserwatora. Unikalność po parze (zgłoszenie, użytkownik) jest w bazie —
/// wzorem <c>ProjectMemberConfiguration</c>.</summary>
public sealed class IssueWatcherConfiguration : IEntityTypeConfiguration<IssueWatcher>
{
    public void Configure(EntityTypeBuilder<IssueWatcher> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("issue_watcher");
        builder.HasKey(w => w.Uuid);

        // Klucz nadaje aplikacja (Entity.NewUuid — UUID v7), baza nigdy go nie generuje.
        // Bez tej deklaracji EF Core, widząc PIERWSZY RAZ encję odkrytą przez fixup nawigacji
        // (Issue.Watch() dopisuje ją do już śledzonej — bo wczytanej — kolekcji Watchers, bez
        // jawnego Add() na DbContext) z NIEPUSTYM kluczem, zakłada że to JUŻ ISTNIEJĄCY wiersz
        // i planuje UPDATE zamiast INSERT-a. UPDATE trafia w 0 wierszy (nowy wiersz nie istnieje)
        // i wybucha jako DbUpdateConcurrencyException — pozorny konflikt, nie prawdziwy wyścig.
        // Ten sam mechanizm i to samo rozwiązanie opisuje komentarz przy
        // Catalog.Domain.Products.ProductLinks (tam wybrano odwrotną stronę tej samej monety:
        // klucz zostaje domyślny, a wartość nadaje `DEFAULT gen_random_uuid()` w bazie).
        builder.Property(w => w.Uuid).ValueGeneratedNever();

        builder.Property(w => w.IssueUuid).IsRequired();
        builder.Property(w => w.UserUuid).IsRequired();
        builder.Property(w => w.OptedOutAt);

        builder.HasIndex(w => new { w.IssueUuid, w.UserUuid }).IsUnique();
    }
}
