using Microsoft.EntityFrameworkCore;

namespace Erp.BuildingBlocks.Persistence;

/// <summary>
/// Wspólna konfiguracja dostawcy bazy dla wszystkich modułów — żeby żaden nie zapomniał
/// o schemacie historii migracji ani o konwencji nazw.
/// </summary>
public static class ErpDbContextOptionsExtensions
{
    /// <summary>
    /// Podpina Npgsql z ustawieniami obowiązującymi w całym backendzie.
    ///
    /// Dwie rzeczy są tu nieoczywiste i istotne:
    /// <list type="bullet">
    ///   <item><b>Tabela historii migracji w schemacie modułu.</b> Domyślnie EF trzyma
    ///     <c>__EFMigrationsHistory</c> w schemacie <c>public</c> — przy kilku modułach w jednej bazie
    ///     wszystkie biłyby się o jedną tabelę i migracje jednego modułu „widziałyby” migracje innego.</item>
    ///   <item><b><c>snake_case</c></b> — tabele i kolumny w konwencji Postgresa, bez ręcznego
    ///     <c>HasColumnName</c> przy każdej właściwości.</item>
    /// </list>
    /// </summary>
    /// <param name="optionsBuilder">Builder konfiguracji kontekstu.</param>
    /// <param name="connectionString">Łańcuch połączenia do Postgresa.</param>
    /// <param name="schema">Schemat modułu — ten sam, który zwraca <c>ErpDbContext.Schema</c>.</param>
    /// <param name="migrationsAssembly">Zestaw, w którym leżą migracje (projekt Infrastructure modułu).</param>
    public static DbContextOptionsBuilder UseErpPostgres(
        this DbContextOptionsBuilder optionsBuilder,
        string connectionString,
        string schema,
        string? migrationsAssembly = null)
    {
        ArgumentNullException.ThrowIfNull(optionsBuilder);
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);
        ArgumentException.ThrowIfNullOrWhiteSpace(schema);

        return optionsBuilder
            .UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", schema);

                if (!string.IsNullOrWhiteSpace(migrationsAssembly))
                {
                    npgsql.MigrationsAssembly(migrationsAssembly);
                }

                // Zapytanie pobierające kilka kolekcji naraz (produkt + kategorie + multimedia
                // + gwarancje) w jednym SELECT-cie daje iloczyn kartezjański: produkt ze 100
                // gwarancjami, 5 multimediami i 3 kategoriami to 1500 wierszy na JEDEN produkt.
                // Split query wykonuje osobny SELECT na kolekcję i eliminuje to mnożenie.
                npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            })
            .UseSnakeCaseNamingConvention();
    }
}
