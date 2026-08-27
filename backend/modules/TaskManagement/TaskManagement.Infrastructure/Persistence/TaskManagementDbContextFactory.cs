using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TaskManagement.Infrastructure.Persistence;

/// <summary>Fabryka używana wyłącznie przez narzędzia <c>dotnet ef</c> — pozwala wygenerować
/// migrację bez podnoszenia całego hosta (patrz <c>docs/backend/persistence-ef.md</c> §7).</summary>
public sealed class TaskManagementDbContextFactory : IDesignTimeDbContextFactory<TaskManagementDbContext>
{
    private const string DefaultConnectionString =
        "Host=127.0.0.1;Port=5432;Database=erp;Username=erp;Password=erp";

    public TaskManagementDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("TASKMANAGEMENT_CONNECTION_STRING") ?? DefaultConnectionString;

        var optionsBuilder = new DbContextOptionsBuilder<TaskManagementDbContext>();
        optionsBuilder.UseErpPostgres(
            connectionString,
            TaskManagementDbContext.SchemaName,
            typeof(TaskManagementDbContextFactory).Assembly.GetName().Name);

        return new TaskManagementDbContext(optionsBuilder.Options);
    }
}
