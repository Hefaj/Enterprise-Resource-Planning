using Erp.BuildingBlocks.Persistence;
using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Erp.IntegrationTests;

/// <summary>
/// Świeża baza ze schematem Identity, założona prawdziwymi migracjami — ten sam wzorzec co
/// <see cref="TaskManagementDatabase"/>: migracja jest częścią dowodu (kolumny `kind`/
/// `description` z <c>AddUserAccountKind</c>, patrz API-003).
/// </summary>
internal sealed class IdentityDatabase : IAsyncDisposable
{
    private readonly string _connectionString;

    private IdentityDatabase(string connectionString) => _connectionString = connectionString;

    public static async Task<IdentityDatabase> CreateAsync(PostgresFixture postgres, CancellationToken cancellationToken)
    {
        var connectionString = await postgres.CreateDatabaseAsync("identity", cancellationToken);
        var database = new IdentityDatabase(connectionString);

        await using var context = database.NewContext();
        await context.Database.MigrateAsync(cancellationToken);

        return database;
    }

    public string ConnectionString => _connectionString;

    public IdentityDbContext NewContext()
    {
        var builder = new DbContextOptionsBuilder<IdentityDbContext>();
        builder.UseErpPostgres(
            _connectionString,
            IdentityDbContext.SchemaName,
            typeof(IdentityDbContext).Assembly.GetName().Name);

        return new IdentityDbContext(builder.Options);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
