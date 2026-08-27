using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;

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
        builder.Property(i => i.Key).HasMaxLength(32).IsRequired();
        builder.Property(i => i.Title).HasMaxLength(512).IsRequired();
        builder.Property(i => i.Description);
        builder.Property(i => i.Priority).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(i => i.StateUuid).IsRequired();
        builder.Property(i => i.ReporterUuid).IsRequired();
        builder.Property(i => i.IsRestricted).IsRequired();
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

        // Skan terminów (faza 5) idzie po tym indeksie, nie po wpisie harmonogramu per zgłoszenie —
        // rozdzielczość jest dzienna, więc drugi mechanizm z DMS-u byłby kosztem bez zysku (§9.3).
        builder.HasIndex(i => i.DueAt);

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(i => i.ProjectUuid)
            .OnDelete(DeleteBehavior.Restrict);

        // Rodzic bez klucza obcego do samego siebie z kaskadą: usunięcie epiku nie może
        // wykasować podzadań po cichu. Hierarchię wypełnia faza 4.
        builder.HasIndex(i => i.ParentUuid);
    }
}
