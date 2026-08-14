using Catalog.Domain.Categories;
using Catalog.Domain.Models;
using Catalog.Domain.Multimedia;
using Catalog.Domain.Products;
using Catalog.Domain.Warranties;
using Catalog.Application.Contracts;
using Catalog.Infrastructure.Persistence;
using Catalog.Infrastructure.Queries;
using Catalog.Infrastructure.Seed;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Contracts;
using Erp.BuildingBlocks.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Catalog.Infrastructure;

/// <summary>Rejestracja warstwy infrastruktury modułu Catalog.</summary>
public static class CatalogInfrastructureExtensions
{
    /// <summary>Nazwa wpisu z łańcuchem połączenia w sekcji <c>ConnectionStrings</c>.</summary>
    public const string ConnectionStringName = "CatalogDb";

    /// <summary>Podpina kontekst bazy, utrzymanie drzewa i dane startowe.</summary>
    public static IServiceCollection AddCatalogInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Brak łańcucha połączenia `ConnectionStrings:{ConnectionStringName}` w konfiguracji.");

        services.AddDbContext<CatalogDbContext>(options => options.UseErpPostgres(
            connectionString,
            CatalogDbContext.SchemaName,
            typeof(CatalogDbContext).Assembly.GetName().Name));

        services.AddScoped<CategoryClosureMaintainer>();
        services.AddScoped<CatalogSeeder>();

        services.AddScoped<IProductQueries, ProductQueries>();
        services.AddScoped<ICategoryQueries, CategoryQueries>();
        services.AddScoped<IModelQueries, ModelQueries>();
        services.AddScoped<IMultimediaQueries, MultimediaQueries>();
        services.AddScoped<IWarrantyQueries, WarrantyQueries>();

        var seedOptions = configuration.GetSection(CatalogSeedOptions.SectionName).Get<CatalogSeedOptions>()
            ?? new CatalogSeedOptions();
        services.AddSingleton(seedOptions);

        services.AddSingleton<IAggregateSignatureMap>(BuildSignatureMap());

        services.AddHostedService<CatalogDatabaseInitializer>();

        return services;
    }

    /// <summary>
    /// Mapa agregat → kanał synchronizacji. To ona sprawia, że zapis dowolnego z tych agregatów
    /// automatycznie rozgłasza <c>AggregateChanged</c> — bez ani jednej linijki w handlerze komendy.
    ///
    /// Agregaty spoza tej mapy (np. <c>Job</c>, którego repliką zajmuje się Notification)
    /// świadomie nie trafiają do klientów bezpośrednio.
    /// </summary>
    private static AggregateSignatureMap BuildSignatureMap()
        => new AggregateSignatureMap()
            .Register<Product>(AggregateSignatures.CatalogProduct)
            .Register<Category>(AggregateSignatures.CatalogCategory)
            .Register<ProductModel>(AggregateSignatures.CatalogModel)
            .Register<MultimediaAsset>(AggregateSignatures.CatalogMultimedia)
            .Register<Warranty>(AggregateSignatures.CatalogWarranty);
}
