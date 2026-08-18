using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Identity.Infrastructure.Persistence;

/// <summary>Fabryka używana wyłącznie przez narzędzia <c>dotnet ef</c> — patrz
/// <c>Catalog.Infrastructure.Persistence.CatalogDbContextFactory</c> dla pełnego uzasadnienia.</summary>
public sealed class IdentityDbContextFactory : IDesignTimeDbContextFactory<IdentityDbContext>
{
    private const string DefaultConnectionString =
        "Host=127.0.0.1;Port=5432;Database=erp;Username=erp;Password=erp";

    public IdentityDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("IDENTITY_CONNECTION_STRING") ?? DefaultConnectionString;

        var optionsBuilder = new DbContextOptionsBuilder<IdentityDbContext>();
        optionsBuilder.UseErpPostgres(
            connectionString,
            IdentityDbContext.SchemaName,
            typeof(IdentityDbContextFactory).Assembly.GetName().Name);

        return new IdentityDbContext(optionsBuilder.Options);
    }
}
