using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using FastEndpoints.Swagger;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Erp.BuildingBlocks.Api;

/// <summary>
/// Wspólny bootstrap hosta HTTP dla wszystkich mikroserwisów. Dziś ta konfiguracja jest
/// skopiowana słowo w słowo między <c>Program.cs</c> Catalogu i Notification (razem z listą
/// portów CORS, która przy każdym nowym module rozjeżdża się o jeden wpis) — tutaj jest raz.
/// </summary>
public static class ErpApiExtensions
{
    /// <summary>Nazwa polityki CORS.</summary>
    public const string CorsPolicyName = "ErpCorsPolicy";

    /// <summary>
    /// Rejestruje FastEndpoints, Swagger i CORS dla frontendowych mikrofrontendów.
    /// </summary>
    /// <param name="services">Kolekcja usług.</param>
    /// <param name="serviceTitle">
    /// Stabilna, jednowyrazowa nazwa serwisu (np. <c>"Catalog"</c>) — tytuł dokumentu Swagger,
    /// z którego FastEndpoints wyprowadza wspólny tag dla endpointów bez jawnej grupy tagów.
    /// NSwag generuje z tego tagu nazwę klienta (<c>{tag}Client</c>), więc jest to część
    /// zamrożonego kontraktu z frontendem — świadomie parametr WYMAGANY, bez wartości domyślnej.
    ///
    /// Bez tego FastEndpoints pada z powrotem na nazwę zestawu Api (<c>Catalog.Api</c>),
    /// co dokładnie tu się wydarzyło: restrukturyzacja Catalogu na warstwy w fazie 2 przemianowała
    /// zestaw z <c>Catalog</c> na <c>Catalog.Api</c>, cicho zmieniając tag na „Catalog.Api” —
    /// dopiero regeneracja klienta w fazie 5 przemianowała <c>CatalogClient</c> na
    /// <c>Catalog_ApiClient</c> i wywaliła kompilację 4 orkiestratorów. Jawny, stabilny tytuł
    /// odrywa nazwę w kontrakcie od nazwy zestawu .NET, więc kolejna restrukturyzacja projektu
    /// tego już nie powtórzy.
    /// </param>
    /// <param name="allowedOrigins">Dozwolone originy. Domyślnie porty dev hosta i remotów
    /// (4200–4210) — patrz mapa portów w <c>CLAUDE.md</c>.</param>
    public static IServiceCollection AddErpApi(
        this IServiceCollection services,
        string serviceTitle,
        IEnumerable<string>? allowedOrigins = null)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentException.ThrowIfNullOrWhiteSpace(serviceTitle);

        var origins = allowedOrigins?.ToArray() ?? DefaultDevOrigins();

        services.AddSingleton<IClock, SystemClock>();

        // Kontekst wykonania jest scoped i mutowalny: wypełnia go middleware HTTP,
        // a przy zadaniach w tle podstawia go BulkCommandRunner.
        //
        // Jedna, BEZPOŚREDNIA rejestracja typ→interfejs — celowo bez pośredniej fabryki
        // `services.AddScoped<IExecutionContext>(sp => sp.GetRequiredService<MutableExecutionContext>())`.
        // Wolverine od wersji 6 statycznie analizuje graf zależności każdego handlera przy
        // generowaniu kodu i odrzuca „nieprzezroczyste” rejestracje lambda jako
        // ServiceLocationPolicy.NotAllowed — każdy handler pośrednio zależny od IUnitOfWork
        // (a więc i od IExecutionContext) failował już przy starcie hosta. Konsumenci, którzy
        // potrzebują metody `Set(...)` (na razie tylko BulkCommandRunner), wciąż mogą do niej
        // dotrzeć przez rzutowanie `is MutableExecutionContext` po wstrzyknięciu interfejsu —
        // to jedna instancja per scope niezależnie od sposobu rejestracji.
        services.AddScoped<IExecutionContext, MutableExecutionContext>();

        services.AddFastEndpoints();
        services.SwaggerDocument(o =>
        {
            o.DocumentSettings = settings => settings.Title = serviceTitle;
        });

        services.AddCors(options =>
        {
            options.AddPolicy(CorsPolicyName, policy => policy
                .WithOrigins(origins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                // Wymagane przez SignalR (ciasteczka/negocjacja) — bez tego hub nie zestawi połączenia.
                .AllowCredentials());
        });

        return services;
    }

    /// <summary>Podpina pipeline HTTP w kolejności wymaganej przez CORS i FastEndpoints.</summary>
    /// <param name="app">Aplikacja.</param>
    /// <param name="serviceTitle">Ta sama wartość, co przekazana do <see cref="AddErpApi"/> —
    /// wymuszona jawnie na endpoincie jako OpenAPI tag (<c>WithTags</c>), bo FastEndpoints
    /// domyślnie wyprowadza tag dla dokumentu <c>Microsoft.AspNetCore.OpenApi</c>
    /// (<c>/openapi/v1.json</c> — to on jest źródłem dla NSwag, nie dokument spod
    /// <c>SwaggerDocument()</c>) z nazwy ZESTAWU Api, więc bez jawnego tagu ta sama pułapka
    /// wraca przy każdej kolejnej restrukturyzacji projektu.</param>
    public static WebApplication UseErpApi(this WebApplication app, string serviceTitle)
    {
        ArgumentNullException.ThrowIfNull(app);
        ArgumentException.ThrowIfNullOrWhiteSpace(serviceTitle);

        app.UseCors(CorsPolicyName);

        // Przed endpointami, bo to one (a dokładniej BatchEndpointBase → IJobStore) czytają
        // kontekst przy tworzeniu zadania. Po CORS, żeby preflight nie przechodził przez
        // logikę tożsamości.
        app.UseMiddleware<ExecutionContextMiddleware>();

        app.UseFastEndpoints(config =>
        {
            // NSwag generuje nazwy metod klienta z nazw endpointów. Bez tego zabiegu
            // wygenerowany klient TypeScript dostaje nazwy z sufiksem „Endpoint”,
            // co rozjeżdża się z wywołaniami w orkiestratorach.
            config.Endpoints.Configurator = endpoint =>
            {
                var name = endpoint.EndpointType.Name;
                if (name.EndsWith("Endpoint", StringComparison.Ordinal))
                {
                    name = name[..^"Endpoint".Length];
                }

                endpoint.Description(d => d.WithName(name).WithTags(serviceTitle));
            };
        });

        app.UseSwaggerGen();

        return app;
    }

    private static string[] DefaultDevOrigins()
        => [.. Enumerable.Range(4200, 11).Select(port => $"http://localhost:{port}")];
}
