using Erp.BuildingBlocks.Application.Abstractions;
using FastEndpoints;
using FastEndpoints.Swagger;
using Microsoft.AspNetCore.Builder;
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
    /// <param name="allowedOrigins">Dozwolone originy. Domyślnie porty dev hosta i remotów
    /// (4200–4210) — patrz mapa portów w <c>CLAUDE.md</c>.</param>
    public static IServiceCollection AddErpApi(
        this IServiceCollection services,
        IEnumerable<string>? allowedOrigins = null)
    {
        ArgumentNullException.ThrowIfNull(services);

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
        services.SwaggerDocument();

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
    public static WebApplication UseErpApi(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        app.UseCors(CorsPolicyName);

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

                endpoint.Description(d => d.WithName(name));
            };
        });

        app.UseSwaggerGen();

        return app;
    }

    private static string[] DefaultDevOrigins()
        => [.. Enumerable.Range(4200, 11).Select(port => $"http://localhost:{port}")];
}
