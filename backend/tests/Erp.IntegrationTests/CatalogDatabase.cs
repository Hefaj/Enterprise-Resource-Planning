using Catalog.Infrastructure.Persistence;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.IntegrationTests;

/// <summary>
/// Świeża baza ze schematem Catalogu, założona <b>prawdziwymi migracjami</b>.
///
/// <para><c>EnsureCreated</c> byłoby tu wygodniejsze i zarazem gorsze: budowałoby schemat wprost
/// z modelu, omijając łańcuch migracji — a wtedy test przechodziłby również wtedy, gdy migracja
/// dodająca <c>report_run.heartbeat_at</c> jest zepsuta albo nie istnieje. Skoro faza 1 dokłada
/// kolumnę migracją, to migracja ma być częścią dowodu.</para>
/// </summary>
internal sealed class CatalogDatabase : IAsyncDisposable
{
    private readonly string _connectionString;

    private CatalogDatabase(string connectionString) => _connectionString = connectionString;

    public static async Task<CatalogDatabase> CreateAsync(PostgresFixture postgres, CancellationToken cancellationToken)
    {
        var connectionString = await postgres.CreateDatabaseAsync("catalog", cancellationToken);
        var database = new CatalogDatabase(connectionString);

        await using var context = database.NewContext();
        await context.Database.MigrateAsync(cancellationToken);

        return database;
    }

    /// <summary>
    /// Nowy kontekst = nowe połączenie i nowy ChangeTracker, czyli odpowiednik osobnej instancji
    /// serwisu. Współdzielenie jednego kontekstu między „runnerami" ukrywałoby dokładnie te
    /// wyścigi, których te testy szukają.
    /// </summary>
    public CatalogDbContext NewContext()
    {
        var builder = new DbContextOptionsBuilder<CatalogDbContext>();
        builder.UseErpPostgres(
            _connectionString,
            CatalogDbContext.SchemaName,
            typeof(CatalogDbContext).Assembly.GetName().Name);

        return new CatalogDbContext(builder.Options);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
