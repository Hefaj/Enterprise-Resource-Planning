using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Notification.Infrastructure.Persistence;

/// <summary>Fabryka używana wyłącznie przez narzędzia <c>dotnet ef</c> — patrz
/// <c>Catalog.Infrastructure.Persistence.CatalogDbContextFactory</c> dla pełnego uzasadnienia.</summary>
public sealed class NotificationDbContextFactory : IDesignTimeDbContextFactory<NotificationDbContext>
{
    private const string DefaultConnectionString =
        "Host=localhost;Port=5432;Database=erp;Username=erp;Password=erp";

    public NotificationDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("NOTIFICATION_CONNECTION_STRING") ?? DefaultConnectionString;

        var optionsBuilder = new DbContextOptionsBuilder<NotificationDbContext>();
        optionsBuilder.UseErpPostgres(
            connectionString,
            NotificationDbContext.SchemaName,
            typeof(NotificationDbContextFactory).Assembly.GetName().Name);

        return new NotificationDbContext(optionsBuilder.Options);
    }
}
