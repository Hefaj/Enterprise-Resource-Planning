using Erp.BuildingBlocks.Domain;
using Microsoft.EntityFrameworkCore;

namespace Erp.BuildingBlocks.Persistence;

/// <summary>
/// Baza dla <c>DbContext</c> każdego modułu. Ustala trzy rzeczy, których nie chcemy powtarzać
/// (ani rozjechać) między modułami:
///
/// <list type="number">
///   <item><b>Izolacja schematu.</b> Każdy moduł mieszka we własnym schemacie Postgresa
///     (<c>catalog</c>, <c>notification</c>, <c>sales</c>) razem ze swoją tabelą historii migracji.
///     Przy przyjętej topologii „jedna baza, schemat per moduł” to jedyna rzecz, która trzyma
///     granicę modułu — dlatego <see cref="Schema"/> jest abstrakcyjne i musi być świadomie podane.</item>
///   <item><b>Współbieżność optymistyczna na <c>xmin</c>.</b> Systemowa kolumna Postgresa pełni rolę
///     tokenu wersji, więc żaden agregat nie potrzebuje własnej kolumny <c>RowVersion</c>.
///     Ma to realne znaczenie przy operacjach masowych: dwa równoległe joby dotykające tego samego
///     produktu skończą się kontrolowanym konfliktem, a nie cichym nadpisaniem.</item>
///   <item><b>Konwencje nazewnicze</b> — <c>snake_case</c>, ustawiane w <c>UseSnakeCaseNamingConvention</c>
///     przy konfiguracji dostawcy (patrz <see cref="ErpDbContextOptionsExtensions"/>).</item>
/// </list>
/// </summary>
public abstract class ErpDbContext : DbContext
{
    protected ErpDbContext(DbContextOptions options) : base(options)
    {
    }

    /// <summary>Schemat Postgresa, w którym żyje ten moduł. Bez wartości domyślnej — pomyłka
    /// tutaj oznaczałaby dwa moduły dzielące tabele, więc każdy musi ją podać jawnie.</summary>
    protected abstract string Schema { get; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        modelBuilder.HasDefaultSchema(Schema);

        base.OnModelCreating(modelBuilder);

        ApplyAggregateConventions(modelBuilder);
    }

    /// <summary>
    /// Nadaje wszystkim korzeniom agregatów wspólne cechy: <c>Uuid</c> jako klucz główny
    /// i <c>xmin</c> jako token współbieżności. Robione konwencją, a nie w konfiguracji każdej
    /// encji, bo pominięcie tokenu w jednej konfiguracji jest niewidoczne do momentu, w którym
    /// dwie równoległe zmiany po cichu się nadpiszą.
    /// </summary>
    private static void ApplyAggregateConventions(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var clrType = entityType.ClrType;

            if (!typeof(AggregateRoot).IsAssignableFrom(clrType))
            {
                continue;
            }

            var builder = modelBuilder.Entity(clrType);

            if (entityType.FindPrimaryKey() is null)
            {
                builder.HasKey(nameof(Entity.Uuid));
            }

            // xmin to systemowa kolumna Postgresa — nie tworzy nowej kolumny w tabeli,
            // a daje pełną kontrolę współbieżności.
            builder.Property<uint>("xmin")
                .HasColumnName("xmin")
                .HasColumnType("xid")
                .ValueGeneratedOnAddOrUpdate()
                .IsConcurrencyToken();
        }
    }
}
