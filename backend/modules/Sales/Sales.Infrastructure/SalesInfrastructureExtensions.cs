using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Sales.Application.Abstractions;
using Sales.Application.Customers;
using Sales.Domain.Customers;
using Sales.Infrastructure.Persistence;
using Sales.Infrastructure.Queries;
using Sales.Infrastructure.Repositories;
using Sales.Infrastructure.Seed;

namespace Sales.Infrastructure;

/// <summary>
/// Rejestracja warstwy infrastruktury modułu Sales. Jeden do jednego z
/// <c>Catalog.Infrastructure.CatalogInfrastructureExtensions</c> — dokładnie to jest sedno
/// tego modułu: identyczny kształt rejestracji, zero nowego kodu w BuildingBlocks.
/// </summary>
public static class SalesInfrastructureExtensions
{
    /// <summary>Nazwa wpisu z łańcuchem połączenia w sekcji <c>ConnectionStrings</c>.</summary>
    public const string ConnectionStringName = "SalesDb";

    public static IServiceCollection AddSalesInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Brak łańcucha połączenia `ConnectionStrings:{ConnectionStringName}` w konfiguracji.");

        services.AddDbContext<SalesDbContext>(options => options.UseErpPostgres(
            connectionString,
            SalesDbContext.SchemaName,
            typeof(SalesDbContext).Assembly.GetName().Name));

        // Repozytoria i zapytania (ICustomerQueries → CustomerQueries) rejestruje `AddErpModule`
        // z Program.cs po konwencji nazewniczej — patrz ErpModuleRegistrationExtensions.
        services.AddScoped<SalesSeeder>();

        var seedOptions = configuration.GetSection(SalesSeedOptions.SectionName).Get<SalesSeedOptions>()
            ?? new SalesSeedOptions();
        services.AddSingleton(seedOptions);

        // Kolejność rejestracji ma znaczenie: hosted service'y startują sekwencyjnie
        // w tej kolejności, więc migracja MUSI zostać zarejestrowana przed seedem.
        services.AddHostedService<ErpDatabaseMigrator<SalesDbContext>>();
        services.AddHostedService<SalesSeedInitializer>();

        // Jedyny agregat modułu widoczny dla klientów przez SignalR — zapis Customer
        // automatycznie generuje AggregateChanged na sygnaturze `sales.customer`.
        services.AddSingleton<IAggregateSignatureMap>(
            new AggregateSignatureMap().Register<Customer>(AggregateSignatures.SalesCustomer));

        return services;
    }
}
