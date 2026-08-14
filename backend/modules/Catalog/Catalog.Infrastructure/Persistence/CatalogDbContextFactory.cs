using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Catalog.Infrastructure.Persistence;

/// <summary>
/// Fabryka używana wyłącznie przez narzędzia <c>dotnet ef</c> (generowanie i stosowanie migracji).
///
/// Istnieje, bo <c>dotnet ef</c> musi umieć zbudować kontekst bez uruchamiania całego hosta —
/// a host wymaga działającego RabbitMQ (Wolverine) i pełnej konfiguracji. Dzięki tej fabryce
/// migracje da się wygenerować offline, bez podniesionej infrastruktury.
///
/// Łańcuch połączenia bierze ze zmiennej <c>CATALOG_CONNECTION_STRING</c>, a w jej braku
/// używa domyślnych ustawień z <c>backend/podman-compose.yml</c>.
/// </summary>
public sealed class CatalogDbContextFactory : IDesignTimeDbContextFactory<CatalogDbContext>
{
    private const string DefaultConnectionString =
        "Host=localhost;Port=5432;Database=erp;Username=erp;Password=erp";

    public CatalogDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("CATALOG_CONNECTION_STRING") ?? DefaultConnectionString;

        var optionsBuilder = new DbContextOptionsBuilder<CatalogDbContext>();
        optionsBuilder.UseErpPostgres(
            connectionString,
            CatalogDbContext.SchemaName,
            typeof(CatalogDbContextFactory).Assembly.GetName().Name);

        return new CatalogDbContext(optionsBuilder.Options);
    }
}
