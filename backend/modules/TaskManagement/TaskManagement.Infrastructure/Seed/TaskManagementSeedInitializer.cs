using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace TaskManagement.Infrastructure.Seed;

/// <summary>
/// Zakłada schemat systemowy stanów i — jeśli włączone — dane przykładowe. Migracja jest odrębną,
/// współdzieloną odpowiedzialnością (<c>ErpDatabaseMigrator&lt;TaskManagementDbContext&gt;</c>).
///
/// <para>Pod blokującą dzierżawą <c>taskmgmt:seed</c>: równoległy start dwóch instancji bez niej
/// albo zduplikuje projekty przykładowe, albo wyłoży się na unikalności <c>project.code</c>,
/// zależnie od tego, co akurat siadło pierwsze
/// (<c>docs/architecture/multi-instance.md</c> §3.1).</para>
/// </summary>
[ClusterSafe("Blokująca dzierżawa taskmgmt:seed — bez niej równoległy start dwóch instancji "
    + "duplikuje schemat systemowy i projekty przykładowe albo łamie unikalność project.code.")]
public sealed class TaskManagementSeedInitializer : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public TaskManagementSeedInitializer(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();

        var lease = scope.ServiceProvider.GetRequiredService<IExclusiveLease>();
        await using var held = await lease.AcquireAsync("taskmgmt:seed", cancellationToken).ConfigureAwait(false);

        var seeder = scope.ServiceProvider.GetRequiredService<TaskManagementSeeder>();
        await seeder.SeedAsync(cancellationToken).ConfigureAwait(false);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
