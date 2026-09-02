using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskManagement.Domain.Boards;
using TaskManagement.Domain.Issues;
using TaskManagement.Domain.Projects;
using TaskManagement.Domain.Sprints;

namespace TaskManagement.Infrastructure.Persistence.Configurations;

/// <summary>Mapowanie tablicy razem z kolumnami — jeden agregat, ładowany i zapisywany
/// w całości.</summary>
public sealed class BoardConfiguration : IEntityTypeConfiguration<Board>
{
    public void Configure(EntityTypeBuilder<Board> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("board");
        builder.HasKey(b => b.Uuid);

        builder.Property(b => b.ProjectUuid).IsRequired();
        builder.Property(b => b.Name).HasMaxLength(256).IsRequired();
        builder.Property(b => b.Mode).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(b => b.IsDefault).IsRequired();

        // BRD-006 — oś grupowania wierszy. `SwimlaneFieldCode` opcjonalny: ma sens wyłącznie
        // przy `CustomField`, w każdym innym trybie zostaje `null`.
        builder.Property(b => b.SwimlaneMode).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(b => b.SwimlaneFieldCode).HasMaxLength(64);

        builder.HasIndex(b => b.ProjectUuid);

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(b => b.ProjectUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.Columns)
            .WithOne()
            .HasForeignKey(c => c.BoardUuid)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(b => b.Columns).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>Mapowanie kolumny tablicy.</summary>
public sealed class BoardColumnConfiguration : IEntityTypeConfiguration<BoardColumn>
{
    public void Configure(EntityTypeBuilder<BoardColumn> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("board_column");
        builder.HasKey(c => c.Uuid);

        // Klucz nadaje agregat, nie baza — patrz `field_definition`. Dotyczy `BoardSetColumns`
        // na istniejącej tablicy: bez tego dołożona kolumna szłaby UPDATE-em w zero wierszy.
        builder.Property(c => c.Uuid).ValueGeneratedNever();

        builder.Property(c => c.BoardUuid).IsRequired();
        builder.Property(c => c.Name).HasMaxLength(256).IsRequired();
        builder.Property(c => c.OrderNo).IsRequired();

        // BRD-007 — sygnał wyłącznie wizualny, `null` znaczy „bez limitu".
        builder.Property(c => c.WipLimit);

        // Stany kolumny jako `uuid[]`, nie tabela podrzędna: nie mają własnych atrybutów,
        // nikt po nich nie sortuje, a jedyne pytanie brzmi „czy zawiera ten stan”. Tabela
        // dokładałaby przy tym trzeci poziom zagnieżdżenia, którego AggregateChangeScanner
        // świadomie nie obsługuje.
        builder.Property<List<Guid>>("_stateUuids")
            .HasColumnName("state_uuids")
            .HasColumnType("uuid[]")
            .UsePropertyAccessMode(PropertyAccessMode.Field)
            .IsRequired();

        builder.Ignore(c => c.StateUuids);

        builder.HasIndex(c => new { c.BoardUuid, c.OrderNo });
    }
}

/// <summary>
/// Mapowanie karty na tablicy.
///
/// <para>Dwa indeksy i oba niosą regułę. Unikalny <c>(board_uuid, issue_uuid)</c> to
/// niezmiennik „jedno zgłoszenie ma najwyżej jedną kartę na danej tablicy”, egzekwowany
/// <b>bazą, nie kodem aplikacji</b> (<c>docs/backend/task-management.md</c> §3). Zwykły
/// <c>(board_uuid, rank)</c> obsługuje jedyne zapytanie, jakie tablica zadaje: „daj karty
/// w kolejności”.</para>
/// </summary>
public sealed class BoardCardConfiguration : IEntityTypeConfiguration<BoardCard>
{
    public void Configure(EntityTypeBuilder<BoardCard> builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.ToTable("board_card");
        builder.HasKey(c => c.Uuid);

        builder.Property(c => c.BoardUuid).IsRequired();
        builder.Property(c => c.IssueUuid).IsRequired();
        builder.Property(c => c.SprintUuid);
        builder.Property(c => c.UpdatedAt).IsRequired();

        // Zestawienie `C` — porównanie znak po znaku, identycznie jak `string.CompareOrdinal`
        // po stronie serwera i `<` po stronie przeglądarki. Domyślne zestawienie językowe
        // ustawiłoby karty w innej kolejności niż front, co przy indeksowaniu ułamkowym
        // objawia się kartą wracającą na inne miejsce po odświeżeniu.
        builder.Property(c => c.Rank).HasMaxLength(128).UseCollation("C").IsRequired();

        builder.HasIndex(c => new { c.BoardUuid, c.IssueUuid }).IsUnique();
        builder.HasIndex(c => new { c.BoardUuid, c.Rank });

        builder.HasOne<Board>()
            .WithMany()
            .HasForeignKey(c => c.BoardUuid)
            .OnDelete(DeleteBehavior.Cascade);

        // Zamknięcie sprintu nie usuwa kart — karta wraca do backlogu (sprint = null), bo
        // to jest jedna z dwóch jawnych decyzji SPR-003 AC1, nigdy kasowanie w kaskadzie.
        builder.HasOne<Sprint>()
            .WithMany()
            .HasForeignKey(c => c.SprintUuid)
            .OnDelete(DeleteBehavior.SetNull);

        // Usunięcie zgłoszenia zabiera jego karty ze wszystkich tablic. Kolejność bez
        // zgłoszenia nie znaczy nic, a osierocony wiersz zostawiałby dziurę w numeracji.
        builder.HasOne<Issue>()
            .WithMany()
            .HasForeignKey(c => c.IssueUuid)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
