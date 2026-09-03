using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using TaskManagement.Infrastructure.Persistence;

namespace Erp.IntegrationTests;

/// <summary>
/// Świeża baza ze schematem Task Management, założona prawdziwymi migracjami — ten sam wzorzec
/// co <see cref="CatalogDatabase"/> i to samo uzasadnienie: migracja ma być częścią dowodu,
/// <c>EnsureCreated</c> ominąłby dokładnie to, co te testy sprawdzają (predykat widoczności,
/// definicje raportów, merge tagów — kod, który dotyka realnych tabel przez EF/SQL surowy).
/// </summary>
internal sealed class TaskManagementDatabase : IAsyncDisposable
{
    private readonly string _connectionString;

    private TaskManagementDatabase(string connectionString) => _connectionString = connectionString;

    public static async Task<TaskManagementDatabase> CreateAsync(PostgresFixture postgres, CancellationToken cancellationToken)
    {
        var connectionString = await postgres.CreateDatabaseAsync("taskmgmt", cancellationToken);
        var database = new TaskManagementDatabase(connectionString);

        await using var context = database.NewContext();
        await context.Database.MigrateAsync(cancellationToken);

        return database;
    }

    public TaskManagementDbContext NewContext()
    {
        var builder = new DbContextOptionsBuilder<TaskManagementDbContext>();
        builder.UseErpPostgres(
            _connectionString,
            TaskManagementDbContext.SchemaName,
            typeof(TaskManagementDbContext).Assembly.GetName().Name);

        return new TaskManagementDbContext(builder.Options);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
