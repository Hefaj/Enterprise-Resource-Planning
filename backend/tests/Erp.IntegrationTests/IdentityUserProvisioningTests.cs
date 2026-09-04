using System.Security.Claims;
using Erp.BuildingBlocks.Application.Abstractions;
using Identity.Domain.Users;
using Identity.Infrastructure.Persistence;
using Identity.Infrastructure.Provisioning;
using Identity.Infrastructure.Queries;
using Identity.Infrastructure.Repositories;
using Identity.Infrastructure.Seed;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace Erp.IntegrationTests;

/// <summary>
/// API-003 — klucz integracyjny jako klient Keycloaka z własnym zestawem uprawnień. Patrz
/// <c>docs/architecture/security.md</c> §2 i plan w <c>docs/modules/task-management/requirements.md</c>.
///
/// Testuje dwie rzeczy z prawdziwym Postgresem (migracje uwzględniające `AddUserAccountKind`):
/// <list type="number">
///   <item>Regresja bootstrapu: obecność konta `Kind = Service` NIE blokuje automatycznego
///     nadania roli <c>administrator</c> pierwszemu prawdziwemu logowaniu człowieka —
///     <see cref="UserProvisioningService"/> liczy `isFirstUser` wyłącznie po `Kind = Human`.</item>
///   <item>Dowód reużycia AuthZ: CTE efektywnych uprawnień
///     (<see cref="UserAccountQueries.GetEffectivePermissionCodesAsync"/>) działa identycznie
///     dla konta `Kind = Service` bez żadnej zmiany w SQL.</item>
/// </list>
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class IdentityUserProvisioningTests
{
    private readonly PostgresFixture _postgres;

    public IdentityUserProvisioningTests(PostgresFixture postgres) => _postgres = postgres;

    /// <summary>Jednostka pracy minimalna dla testu — zapisuje kontekst wprost, bez outboxu ani
    /// zdarzeń integracyjnych, tak jak inne testy w tym katalogu unikają pełnego
    /// <c>ErpUnitOfWork&lt;&gt;</c> (wymaga hosta DI, którego te testy świadomie nie stawiają —
    /// patrz komentarz w <see cref="TaskManagementTagMergeTests"/>).</summary>
    private sealed class DirectSaveUnitOfWork(IdentityDbContext dbContext) : IUnitOfWork
    {
        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
            => dbContext.SaveChangesAsync(cancellationToken);
    }

    private sealed class FixedClock(DateTimeOffset now) : IClock
    {
        public DateTimeOffset UtcNow { get; } = now;
    }

    [Fact]
    public async Task Klucz_integracyjny_zarejestrowany_przed_pierwszym_logowaniem_nie_blokuje_bootstrapu_administratora()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = await IdentityDatabase.CreateAsync(_postgres, ct);
        var now = DateTimeOffset.UtcNow;

        // Seed roli administrator — w produkcji robi to RoleSeeder na starcie; tu zakładamy ją
        // wprost, bo to jedyny warunek wstępny, który UserProvisioningService sprawdza.
        await using (var seedContext = database.NewContext())
        {
            var administrator = Identity.Domain.Roles.Role.CreateWithUuid(
                Guid.NewGuid(), RoleSeeder.AdministratorRoleCode, "Administrator", isSystem: true);
            seedContext.Roles.Add(administrator);

            // Klucz integracyjny zarejestrowany PRZED jakimkolwiek logowaniem człowieka —
            // dokładnie scenariusz, który psuł bootstrap przed poprawką z §2.
            var serviceAccount = UserAccount.CreateServiceAccount(
                Guid.NewGuid(), "Integracja z magazynem zewnętrznym", "Test API-003", now);
            seedContext.UserAccounts.Add(serviceAccount);

            await seedContext.SaveChangesAsync(ct);
        }

        // Pierwsze prawdziwe logowanie człowieka — nowy, nieistniejący sub.
        var humanSub = Guid.NewGuid();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim("sub", humanSub.ToString()),
                new Claim("email", "jan.kowalski@example.com"),
                new Claim("name", "Jan Kowalski"),
            ],
            authenticationType: "Bearer"));

        await using var context = database.NewContext();
        var userRepository = new UserAccountRepository(context);
        var roleRepository = new RoleRepository(context);
        var service = new UserProvisioningService(
            context, userRepository, roleRepository, new FixedClock(now), new DirectSaveUnitOfWork(context));

        await service.EnsureProvisionedAsync(principal, ct);

        await using var verifyContext = database.NewContext();
        var human = await verifyContext.UserAccounts.FindAsync([humanSub], ct);
        human.ShouldNotBeNull();
        human!.Kind.ShouldBe(UserAccountKind.Human);
        human.RoleGrants.ShouldContain(g => g.RoleUuid != Guid.Empty);
        human.RoleGrants.Count.ShouldBe(1);

        var administratorRole = await verifyContext.Roles
            .FirstAsync(r => r.Code == RoleSeeder.AdministratorRoleCode, ct);
        human.RoleGrants[0].RoleUuid.ShouldBe(administratorRole.Uuid);
    }

    [Fact]
    public async Task Efektywne_uprawnienia_dzialaja_identycznie_dla_konta_serwisowego()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var database = await IdentityDatabase.CreateAsync(_postgres, ct);
        var now = DateTimeOffset.UtcNow;

        const string permissionCode = "identity.integration_client.manage";

        var serviceAccountUuid = Guid.NewGuid();
        await using (var seedContext = database.NewContext())
        {
            var role = Identity.Domain.Roles.Role.CreateWithUuid(Guid.NewGuid(), "integration-role", "Integracje");
            role.AddPermission(permissionCode);
            seedContext.Roles.Add(role);

            var serviceAccount = UserAccount.CreateServiceAccount(
                serviceAccountUuid, "Klucz integracyjny testowy", null, now);
            serviceAccount.AddRole(role.Uuid, now, grantedBy: null, expiresAt: null);
            seedContext.UserAccounts.Add(serviceAccount);

            await seedContext.SaveChangesAsync(ct);
        }

        await using var context = database.NewContext();
        var connectionStringProvider = new IdentityConnectionStringProvider(database.ConnectionString);
        var queries = new UserAccountQueries(context, connectionStringProvider);

        var effectivePermissions = await queries.GetEffectivePermissionCodesAsync(serviceAccountUuid, ct);

        effectivePermissions.ShouldContain(permissionCode);
    }
}
