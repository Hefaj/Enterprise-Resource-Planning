using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Sales.Infrastructure.Seed;

/// <summary>
/// Zasila bazę danymi przykładowymi po starcie, jeśli włączone. Migracja jest odrębną,
/// współdzieloną odpowiedzialnością (<c>ErpDatabaseMigrator&lt;SalesDbContext&gt;</c>) — ten
/// hosted service celowo robi wyłącznie seed, bo tylko to jest specyficzne dla modułu
/// (BuildingBlocks nie ma jak wiedzieć, jakie dane startowe ma dany moduł).
///
/// <para>Pod blokującą dzierżawą <c>sales:seed</c> — równoległy seed z dwóch instancji daje
/// albo duplikaty danych przykładowych, albo naruszenie unikalności, zależnie od tego, co
/// akurat siadło pierwsze.</para>
/// </summary>
[ClusterSafe("Blokująca dzierżawa sales:seed — bez niej równoległy seed daje duplikaty danych "
    + "przykładowych albo naruszenie unikalności.")]
public sealed class SalesSeedInitializer : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly SalesSeedOptions _options;

    public SalesSeedInitializer(IServiceScopeFactory scopeFactory, SalesSeedOptions options)
    {
        _scopeFactory = scopeFactory;
        _options = options;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_options.Enabled)
        {
            return;
        }

        using var scope = _scopeFactory.CreateScope();

        var lease = scope.ServiceProvider.GetRequiredService<IExclusiveLease>();
        await using var held = await lease.AcquireAsync("sales:seed", cancellationToken)
            .ConfigureAwait(false);

        var seeder = scope.ServiceProvider.GetRequiredService<SalesSeeder>();
        await seeder.SeedAsync(cancellationToken).ConfigureAwait(false);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
