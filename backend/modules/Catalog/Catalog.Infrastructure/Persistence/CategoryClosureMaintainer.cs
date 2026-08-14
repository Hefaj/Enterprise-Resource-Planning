using Microsoft.EntityFrameworkCore;

namespace Catalog.Infrastructure.Persistence;

/// <summary>
/// Utrzymuje tabelę domknięcia drzewa kategorii.
///
/// Operacje są napisane surowym SQL-em, nie przez ChangeTracker, i to jest celowe: przebudowa
/// domknięcia dla drzewa rzędu setek tysięcy węzłów oznaczałaby przy podejściu obiektowym
/// materializację milionów wierszy do pamięci procesu. Rekurencyjne CTE robi to samo
/// w całości po stronie bazy, jednym zapytaniem.
/// </summary>
public sealed class CategoryClosureMaintainer
{
    private readonly CatalogDbContext _dbContext;

    public CategoryClosureMaintainer(CatalogDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Przebudowuje całe domknięcie od zera na podstawie kolumny <c>parent_uuid</c>.
    ///
    /// Używane przez seeder (po masowym wstawieniu kategorii) oraz jako narzędzie naprawcze —
    /// domknięcie jest indeksem pochodnym, więc zawsze da się je odtworzyć z drzewa.
    /// </summary>
    public async Task RebuildAllAsync(CancellationToken cancellationToken = default)
    {
        const string sql = $"""
            TRUNCATE TABLE {CatalogDbContext.SchemaName}.category_closure;

            WITH RECURSIVE tree AS (
                -- Każdy węzeł jest swoim własnym przodkiem na głębokości 0. Bez tych wierszy
                -- zapytanie „poddrzewo X" nie obejmowałoby samego X.
                SELECT uuid AS ancestor_uuid, uuid AS descendant_uuid, 0 AS depth
                FROM {CatalogDbContext.SchemaName}.category

                UNION ALL

                SELECT t.ancestor_uuid, c.uuid, t.depth + 1
                FROM tree t
                JOIN {CatalogDbContext.SchemaName}.category c ON c.parent_uuid = t.descendant_uuid
            )
            INSERT INTO {CatalogDbContext.SchemaName}.category_closure (ancestor_uuid, descendant_uuid, depth)
            SELECT ancestor_uuid, descendant_uuid, depth FROM tree;
            """;

        await _dbContext.Database.ExecuteSqlRawAsync(sql, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Dopisuje domknięcie dla nowo utworzonego węzła liścia.
    ///
    /// Nowy węzeł dziedziczy wszystkich przodków rodzica (o głębokości większej o 1) i dostaje
    /// wiersz do samego siebie. Kosztuje tyle, ile wynosi głębokość drzewa — nie jego rozmiar.
    /// </summary>
    public async Task InsertLeafAsync(Guid uuid, Guid? parentUuid, CancellationToken cancellationToken = default)
    {
        if (parentUuid is null)
        {
            // `$$` bo w tekście występują zarówno interpolacje ({{...}}), jak i literalne
            // placeholdery ExecuteSqlRaw ({0}, {1}), które NIE mogą zostać zinterpolowane.
            const string rootSql = $$"""
                INSERT INTO {{CatalogDbContext.SchemaName}}.category_closure (ancestor_uuid, descendant_uuid, depth)
                VALUES ({0}, {0}, 0)
                ON CONFLICT DO NOTHING;
                """;

            await _dbContext.Database.ExecuteSqlRawAsync(rootSql, [uuid], cancellationToken).ConfigureAwait(false);
            return;
        }

        const string sql = $$"""
            INSERT INTO {{CatalogDbContext.SchemaName}}.category_closure (ancestor_uuid, descendant_uuid, depth)
            SELECT ancestor_uuid, {0}, depth + 1
            FROM {{CatalogDbContext.SchemaName}}.category_closure
            WHERE descendant_uuid = {1}
            UNION ALL
            SELECT {0}, {0}, 0
            ON CONFLICT DO NOTHING;
            """;

        await _dbContext.Database
            .ExecuteSqlRawAsync(sql, [uuid, parentUuid.Value], cancellationToken)
            .ConfigureAwait(false);
    }

    /// <summary>
    /// Czy <paramref name="candidateParentUuid"/> leży w poddrzewie <paramref name="categoryUuid"/>.
    ///
    /// Tego nie da się sprawdzić w agregacie <c>Category</c> — pojedynczy węzeł nie zna swojego
    /// poddrzewa. Tu jest to jedno zapytanie po indeksie, zamiast rekurencyjnego wchodzenia w górę.
    /// </summary>
    public Task<bool> WouldCreateCycleAsync(
        Guid categoryUuid,
        Guid candidateParentUuid,
        CancellationToken cancellationToken = default)
        => _dbContext.CategoryClosure
            .AnyAsync(
                e => e.AncestorUuid == categoryUuid && e.DescendantUuid == candidateParentUuid,
                cancellationToken);
}
