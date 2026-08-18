using Erp.BuildingBlocks.Contracts;
using Identity.Domain.Roles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Identity.Infrastructure.Persistence;

namespace Identity.Infrastructure.Seed;

/// <summary>
/// Zakłada rolę systemową <see cref="AdministratorRoleCode"/> z pełnym, bieżącym katalogiem
/// uprawnień (<see cref="Permissions.All"/>) — jedyna rola, którą pierwszy zalogowany
/// użytkownik dostaje automatycznie przy JIT provisioning (patrz
/// <c>Identity.Api.Provisioning.UserProvisioningMiddleware</c>), żeby ktokolwiek w ogóle mógł
/// zacząć zarządzać resztą uprawnień.
///
/// <b>Uruchamiany bezwarunkowo</b> (nie za flagą <c>Seed:Enabled</c> jak przykładowe dane
/// w Catalog/Sales) — to nie jest demo, to strukturalny warunek wstępny działania systemu.
/// Uruchamiany PRZY KAŻDYM starcie i dopisuje brakujące uprawnienia do już istniejącej roli —
/// inaczej dodanie nowego kodu do <see cref="Permissions.All"/> nigdy by nie dotarło do
/// administratora bez ręcznej migracji danych.
/// </summary>
public sealed partial class RoleSeeder
{
    /// <summary>Well-known kod, po którym JIT provisioning odnajduje tę rolę —
    /// świadomie kod, nie zaszyty <c>Guid</c>, żeby seeder i provisioning nie musiały
    /// zgadzać się co do identyfikatora osobno od tego, co i tak trzyma baza.</summary>
    public const string AdministratorRoleCode = "administrator";

    private const int RandomSeed = 20260818;

    private readonly IdentityDbContext _dbContext;
    private readonly ILogger<RoleSeeder> _logger;

    public RoleSeeder(IdentityDbContext dbContext, ILogger<RoleSeeder> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var administrator = await _dbContext.Roles
            .FirstOrDefaultAsync(r => r.Code == AdministratorRoleCode, cancellationToken)
            .ConfigureAwait(false);

        if (administrator is null)
        {
            var random = new Random(RandomSeed);
            var bytes = new byte[16];
            random.NextBytes(bytes);

            administrator = Role.CreateWithUuid(
                new Guid(bytes),
                AdministratorRoleCode,
                "Administrator",
                "Pełen dostęp do systemu — rola systemowa, nadawana automatycznie pierwszemu użytkownikowi.",
                isSystem: true);

            _dbContext.Roles.Add(administrator);
        }

        var missing = 0;
        foreach (var definition in Permissions.All)
        {
            if (!administrator.Permissions.Contains(definition.Code, StringComparer.Ordinal))
            {
                administrator.AddPermission(definition.Code);
                missing++;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        LogSeedCompleted(_logger, missing);
    }

    [LoggerMessage(
        EventId = 1,
        Level = LogLevel.Information,
        Message = "Rola 'administrator' zsynchronizowana: {MissingPermissionsAdded} nowych uprawnień dopisanych.")]
    private static partial void LogSeedCompleted(ILogger logger, int missingPermissionsAdded);
}

/// <summary>Uruchamia <see cref="RoleSeeder"/> po migracji — bezwarunkowo, patrz uzasadnienie
/// w komentarzu klasy.</summary>
public sealed class RoleSeedInitializer : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public RoleSeedInitializer(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var seeder = scope.ServiceProvider.GetRequiredService<RoleSeeder>();
        await seeder.SeedAsync(cancellationToken).ConfigureAwait(false);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
