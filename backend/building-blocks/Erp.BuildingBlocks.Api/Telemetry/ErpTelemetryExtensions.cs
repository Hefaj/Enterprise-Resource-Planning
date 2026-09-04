using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Erp.BuildingBlocks.Api.Telemetry;

/// <summary>
/// Trzy sygnały (logi, metryki, ślady) jednym SDK OpenTelemetry, eksport przez OTLP — patrz
/// docs/operations/observability.md §2-3. Wołane raz z <see cref="ErpApiExtensions.AddErpApi"/>,
/// więc żaden mikroserwis nie może po cichu wystartować bez telemetrii.
/// </summary>
public static class ErpTelemetryExtensions
{
    /// <summary>Domyślny endpoint kolektora OTLP (gRPC) na dev-maszynie — SigNoz, uruchomiony
    /// przez <c>docker-compose.signoz.yml</c>. Nadpisywalny przez <c>Otel:OtlpEndpoint</c>.</summary>
    private const string DefaultOtlpEndpoint = "http://localhost:4317";

    public static IServiceCollection AddErpTelemetry(
        this IServiceCollection services, string serviceTitle, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentException.ThrowIfNullOrWhiteSpace(serviceTitle);
        ArgumentNullException.ThrowIfNull(configuration);

        // Musi wykonać się przed otwarciem jakiegokolwiek połączenia Npgsql, żeby ActivitySource
        // "Npgsql" zaczął emitować ślady zapytań SQL. AddErpApi jest pierwszą linią w każdym
        // Program.cs, więc kolejność względem AddXxxInfrastructure jest bezpieczna.
        AppContext.SetSwitch("Npgsql.EnableTracing", true);

        var otlpEndpointUri = new Uri(configuration["Otel:OtlpEndpoint"] ?? DefaultOtlpEndpoint);

        services.AddOpenTelemetry()
            .ConfigureResource(resource => resource
                .AddService(serviceName: serviceTitle, serviceInstanceId: Environment.MachineName))
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                // Zapytania SQL (Npgsql ma natywny ActivitySource od v7 — brak potrzeby
                // niestabilnego pakietu OpenTelemetry.Instrumentation.EntityFrameworkCore).
                .AddSource("Npgsql")
                // Ślad HTTP → komenda → outbox → konsument przez RabbitMQ (§2 dokumentu) —
                // nazwa źródła potwierdzona w WolverineTracing.ActivitySource (Wolverine 6.28).
                .AddSource("Wolverine")
                .AddOtlpExporter(otlp => otlp.Endpoint = otlpEndpointUri))
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                // GC, thread pool — sekcja 5.1 dokumentu.
                .AddRuntimeInstrumentation()
                // CPU i RAM procesu — odpowiedź na "ile zużywa dany mikroserwis".
                .AddProcessInstrumentation()
                .AddOtlpExporter(otlp => otlp.Endpoint = otlpEndpointUri));

        services.AddLogging(logging => logging.AddOpenTelemetry(otel =>
        {
            otel.IncludeScopes = true;
            otel.IncludeFormattedMessage = true;
            otel.ParseStateValues = true;
            otel.AddOtlpExporter(otlp => otlp.Endpoint = otlpEndpointUri);
        }));

        return services;
    }
}
