using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Sales.Infrastructure.Persistence;

/// <summary>Fabryka używana wyłącznie przez narzędzia <c>dotnet ef</c> — patrz
/// <c>Catalog.Infrastructure.Persistence.CatalogDbContextFactory</c> dla pełnego uzasadnienia.</summary>
public sealed class SalesDbContextFactory : IDesignTimeDbContextFactory<SalesDbContext>
{
    private const string DefaultConnectionString =
        "Host=127.0.0.1;Port=5432;Database=erp;Username=erp;Password=erp";

    public SalesDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("SALES_CONNECTION_STRING") ?? DefaultConnectionString;

        var optionsBuilder = new DbContextOptionsBuilder<SalesDbContext>();
        optionsBuilder.UseErpPostgres(
            connectionString,
            SalesDbContext.SchemaName,
            typeof(SalesDbContextFactory).Assembly.GetName().Name);

        return new SalesDbContext(optionsBuilder.Options);
    }
}
