using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence;
using Identity.Application.Abstractions;
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
/// <c>Sales.Infrastructure.SalesInfrastructureExtensions</c>, z dwiema różnicami: brak
/// <c>IJobDbContext</c>/<c>AddErpBulkJobs</c> (patrz <c>IdentityDbContext</c>) i dwa hosted
/// service'y uzgadniające stan zamiast jednego seedu przykładowych danych —
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

        // Osobno od DbContext — patrz uzasadnienie w IdentityConnectionStringProvider.
        services.AddSingleton(new IdentityConnectionStringProvider(connectionString));

        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IUserAccountRepository, UserAccountRepository>();
        services.AddScoped<IRoleQueries, RoleQueries>();
        services.AddScoped<IUserAccountQueries, UserAccountQueries>();
        services.AddScoped<IPermissionCatalogQueries, PermissionCatalogQueries>();

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

        return services;
    }
}
