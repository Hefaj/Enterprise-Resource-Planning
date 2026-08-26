using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Identity.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Identity.Infrastructure.Seed;

/// <summary>
/// Uzgadnia <c>permission_catalog</c> z <see cref="Permissions.All"/> przy KAŻDYM starcie —
/// nie tylko przy pustej bazie, inaczej niż zwykły seed. Katalog jest kodem (patrz
/// <c>docs/backend/identity-authz.md</c> §3), więc musi się synchronizować z bazą za każdym
/// razem, gdy kod się zmienia: nowy kod → wstawiany; kod, którego już nie ma w
/// <see cref="Permissions.All"/> → oznaczany <c>is_obsolete = true</c>, NIGDY kasowany
/// (istniejące nadania mogą wciąż na niego wskazywać).
///
/// <para><b>Wiele instancji.</b> Uzgadnianie chodzi przy KAŻDYM starcie, więc przy równoległym
/// starcie N instancji wyścig na <c>INSERT</c> jest nie wyjątkiem, a regułą — i kończy się
/// naruszeniem unikalności kodu uprawnienia, czyli wywróconym startem. Stąd blokująca dzierżawa
/// <c>identity:permission-catalog</c>: instancja B czeka, a potem zastaje katalog uzgodniony
/// i przechodzi przez pętlę nie robiąc nic. Wariant „pomiń, gdy zajęte" byłby tu ryzykowny —
/// instancja B mogłaby ruszyć, zanim nowe uprawnienia w ogóle są w bazie.</para>
/// </summary>
[ClusterSafe("Blokująca dzierżawa identity:permission-catalog — bez niej równoległy start N instancji "
    + "daje wyścig na INSERT i naruszenie unikalności kodu uprawnienia.")]
public sealed partial class PermissionCatalogReconciler : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PermissionCatalogReconciler> _logger;

    public PermissionCatalogReconciler(IServiceScopeFactory scopeFactory, ILogger<PermissionCatalogReconciler> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();

        var lease = scope.ServiceProvider.GetRequiredService<IExclusiveLease>();
        await using var held = await lease
            .AcquireAsync("identity:permission-catalog", cancellationToken)
            .ConfigureAwait(false);

        var dbContext = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();

        var existing = await dbContext.PermissionCatalogEntries.ToDictionaryAsync(
            p => p.Code, StringComparer.Ordinal, cancellationToken).ConfigureAwait(false);

        var currentCodes = new HashSet<string>(Permissions.All.Select(p => p.Code), StringComparer.Ordinal);
        var added = 0;
        var reactivated = 0;

        foreach (var definition in Permissions.All)
        {
            if (existing.TryGetValue(definition.Code, out var entry))
            {
                entry.Module = definition.Module;
                entry.Resource = definition.Resource;
                entry.Action = definition.Action;
                entry.DescriptionKey = definition.DescriptionKey;

                if (entry.IsObsolete)
                {
                    entry.IsObsolete = false;
                    reactivated++;
                }
            }
            else
            {
                dbContext.PermissionCatalogEntries.Add(new PermissionCatalogEntry
                {
                    Code = definition.Code,
                    Module = definition.Module,
                    Resource = definition.Resource,
                    Action = definition.Action,
                    DescriptionKey = definition.DescriptionKey,
                    IsObsolete = false,
                });
                added++;
            }
        }

        var obsoleted = 0;
        foreach (var entry in existing.Values)
        {
            if (!currentCodes.Contains(entry.Code) && !entry.IsObsolete)
            {
                entry.IsObsolete = true;
                obsoleted++;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        LogReconciled(_logger, added, obsoleted, reactivated);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Information,
        Message = "Katalog uprawnień uzgodniony: {Added} nowych, {Obsoleted} oznaczonych jako obsolete, {Reactivated} przywróconych.")]
    private static partial void LogReconciled(ILogger logger, int added, int obsoleted, int reactivated);
}
