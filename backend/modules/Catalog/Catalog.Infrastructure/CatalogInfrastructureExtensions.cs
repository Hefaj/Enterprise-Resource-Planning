using Catalog.Domain.Attributes;
using Catalog.Domain.Categories;
using Catalog.Domain.Codes;
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
        services.AddScoped<ICodeTypeQueries, CodeTypeQueries>();
        services.AddScoped<IAttributeQueries, AttributeQueries>();

        var seedOptions = configuration.GetSection(CatalogSeedOptions.SectionName).Get<CatalogSeedOptions>()
            ?? new CatalogSeedOptions();
        services.AddSingleton(seedOptions);

        services.AddSingleton<IAggregateSignatureMap>(BuildSignatureMap());

        services.AddSingleton<IPersistenceExceptionTranslator>(
            new PostgresExceptionTranslator(BuildUniqueConstraintErrorCodes()));

        services.AddHostedService<CatalogDatabaseInitializer>();

        return services;
    }

    /// <summary>
    /// Mapa indeks unikalny → kod błędu domenowego. Nazwy pochodzą z konwencji EF i są
    /// widoczne w wygenerowanych migracjach; przemianowanie indeksu bez aktualizacji tej mapy
    /// nie wywali builda, tylko po cichu wróci do raportowania <c>persistence_error</c>.
    ///
    /// Kody muszą się zgadzać z tymi, którymi posługuje się walidacja wsadowa
    /// (<c>ProductDuplicateRule</c>) — inaczej ten sam problem miałby dwie różne nazwy
    /// w zależności od tego, czy złapał go pre-check, czy baza.
    /// </summary>
    private static Dictionary<string, string> BuildUniqueConstraintErrorCodes()
        => new(StringComparer.Ordinal)
        {
            ["ix_product_duplicate_key"] = "product_duplicate",
            ["ix_product_code_unique_key"] = "product_code_duplicate",
            ["ix_product_attribute_value_single"] = "product_attribute_duplicate",
        };

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
            .Register<Warranty>(AggregateSignatures.CatalogWarranty)
            .Register<CodeType>(AggregateSignatures.CatalogCodeType)
            .Register<AttributeDefinition>(AggregateSignatures.CatalogAttribute);
}
