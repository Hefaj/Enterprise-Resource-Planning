using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence;
using Erp.BuildingBlocks.Persistence.Concurrency;
using Identity.Application.Abstractions;
using Identity.Application.Audit;
using Identity.Application.Permissions;
using Identity.Application.Roles;
using Identity.Application.Users;
using Identity.Domain.Roles;
using Identity.Domain.Users;
using Identity.Infrastructure.Persistence;
using Identity.Infrastructure.Queries;
using Identity.Infrastructure.Repositories;
using Identity.Infrastructure.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Identity.Infrastructure;

/// <summary>
/// Rejestracja warstwy infrastruktury modułu Identity. Kształt jeden do jednego z
/// <c>Sales.Infrastructure.SalesInfrastructureExtensions</c> — obsługa operacji masowych
/// (patrz <c>docs/guides/backend/bulk-commands.md</c>) rejestruje też
/// <c>IPersistenceExceptionTranslator</c>, tak jak Catalog. Wciąż jedna świadoma różnica: dwa
/// hosted service'y uzgadniające stan zamiast jednego seedu przykładowych danych —
/// <see cref="PermissionCatalogReconciler"/> i <see cref="RoleSeedInitializer"/> działają
/// bezwarunkowo przy KAŻDYM starcie, nie tylko na pustej bazie.
/// </summary>
public static class IdentityInfrastructureExtensions
{
    /// <summary>Nazwa wpisu z łańcuchem połączenia w sekcji <c>ConnectionStrings</c>.</summary>
    public const string ConnectionStringName = "IdentityDb";

    public static IServiceCollection AddIdentityInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Brak łańcucha połączenia `ConnectionStrings:{ConnectionStringName}` w konfiguracji.");

        services.AddDbContext<IdentityDbContext>(options => options.UseErpPostgres(
            connectionString,
            IdentityDbContext.SchemaName,
            typeof(IdentityDbContext).Assembly.GetName().Name));

        // Dzierżawa wyłączności idzie razem z kontekstem, bo z niego bierze łańcuch
        // połączenia. Korzystają z niej usługi tła i praca startowa modułu —
        // patrz docs/architecture/multi-instance.md §3.1.
        services.AddErpExclusiveLease<IdentityDbContext>();

        // Osobno od DbContext — patrz uzasadnienie w IdentityConnectionStringProvider.
        services.AddSingleton(new IdentityConnectionStringProvider(connectionString));

        // Repozytoria, zapytania i pozostałe implementacje nazwane po swoim interfejsie
        // (IRoleQueries → RoleQueries, IGrantAuditWriter → GrantAuditWriter…) rejestruje
        // `AddErpModule` z Program.cs po konwencji — patrz ErpModuleRegistrationExtensions.
        services.AddScoped<RoleSeeder>();

        // Kolejność ma znaczenie: hosted service'y startują sekwencyjnie w tej kolejności —
        // migracja, potem uzgodnienie katalogu (potrzebuje istniejącej tabeli), potem rola
        // administrator (nie zależy od katalogu w bazie, tylko od Permissions.All, ale
        // logicznie idzie po uzgodnieniu).
        services.AddHostedService<ErpDatabaseMigrator<IdentityDbContext>>();
        services.AddHostedService<PermissionCatalogReconciler>();
        services.AddHostedService<RoleSeedInitializer>();

        // Agregaty widoczne dla klientów przez SignalR — zapis Role/UserAccount generuje
        // automatycznie AggregateChanged na sygnaturach identity.role/identity.user.
        services.AddSingleton<IAggregateSignatureMap>(new AggregateSignatureMap()
            .Register<Role>(AggregateSignatures.IdentityRole)
            .Register<UserAccount>(AggregateSignatures.IdentityUser));

        services.AddSingleton<IPersistenceExceptionTranslator>(
            new PostgresExceptionTranslator(BuildUniqueConstraintErrorCodes()));

        return services;
    }

    /// <summary>
    /// Mapa indeks unikalny → kod błędu domenowego. Nazwy pochodzą z migracji
    /// <c>InitialIdentitySchema</c>; przemianowanie indeksu bez aktualizacji tej mapy nie wywali
    /// builda, tylko po cichu wróci do raportowania <c>persistence_error</c> — patrz
    /// <c>docs/guides/backend/bulk-commands.md</c> §"Naruszenie unikalności to reguła biznesowa,
    /// nie awaria".
    /// </summary>
    private static Dictionary<string, string> BuildUniqueConstraintErrorCodes()
        => new(StringComparer.Ordinal)
        {
            ["ix_role_code"] = "role_code_duplicate",
            ["ix_user_account_email"] = "user_email_duplicate",
        };
}
