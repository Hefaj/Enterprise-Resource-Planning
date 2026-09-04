using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Erp.BuildingBlocks.Api.Health;

/// <summary>
/// Trzy endpointy zdrowia, nie jeden — kontrakt opisany w
/// <c>docs/operations/observability.md</c> §4. Rejestrowane tu, w <see cref="ErpApiExtensions"/>,
/// z tego samego powodu co CORS i uwierzytelnianie: żaden <c>Program.cs</c> nie ma jak ich pominąć
/// ani rozjechać między mikroserwisami.
/// </summary>
public static class ErpHealthCheckExtensions
{
    /// <summary>Tag odróżniający sprawdzenie liczące się do <c>/health/ready</c>.</summary>
    private const string ReadyTag = "ready";

    /// <summary>Tag odróżniający sprawdzenie liczące się do <c>/health/deps</c>.</summary>
    private const string DepsTag = "deps";

    public static IServiceCollection AddErpHealthChecks(this IServiceCollection services)
    {
        // Tylko Postgres w "ready" — reguła z §4 dokumentu: "do ready trafia wyłącznie to, bez
        // czego instancja nie obsłuży żadnego żądania". RabbitMQ/MinIO/Redis/Identity/Keycloak
        // (miękkie zależności, awaria = degradacja, nie całkowity pad) trafiają do "deps", które
        // czyta monitoring i człowiek, nigdy proxy — inaczej pad jednej zależności wyrzuca zdrowe
        // instancje z rotacji load balancera i zamienia awarię częściową w całkowitą.
        services.AddHealthChecks()
            .AddCheck<PostgresReadinessCheck>("postgres", tags: [ReadyTag]);

        return services;
    }

    /// <summary>
    /// Mapuje <c>/health/live</c>, <c>/health/ready</c> i <c>/health/deps</c>.
    /// <c>live</c> i <c>ready</c> muszą być anonimowe — pyta je orkiestrator/proxy, który nie ma
    /// (i nie powinien mieć) tokenu Keycloaka. Bez jawnego <c>AllowAnonymous()</c> globalny
    /// fallback policy z <see cref="Auth.ErpAuthExtensions.AddErpAuth"/> obejmuje też te
    /// endpointy — dokładnie tak samo, jak każdy inny endpoint bez jawnego wyjątku — więc
    /// orkiestrator dostawałby 401 zamiast odpowiedzi o stanie procesu.
    /// <c>deps</c> zostaje pod tym samym fallbackiem: czyta je monitoring/człowiek, nigdy proxy,
    /// więc wymóg zalogowania nie blokuje niczego, co ma prawo o nią pytać.
    /// </summary>
    public static WebApplication MapErpHealthChecks(this WebApplication app)
    {
        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            // Brak zależności — "proces odpowiada" i nic więcej (§4). Pusty predykat omija
            // wszystkie zarejestrowane sprawdzenia, więc odpowiedź nie zależy od Postgresa.
            Predicate = _ => false,
        }).AllowAnonymous();

        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains(ReadyTag),
        }).AllowAnonymous();

        app.MapHealthChecks("/health/deps", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains(DepsTag),
        });

        return app;
    }

    /// <summary>
    /// Sprawdza wyłącznie, czy Postgres odpowiada — żadnej logiki domenowej. Łańcuch połączenia
    /// nie ma tu ustalonej nazwy (każdy moduł ma własny wpis: <c>IdentityDb</c>,
    /// <c>CatalogDb</c>, ...), a to jeden fizyczny Postgres ze schematem per moduł (patrz
    /// CLAUDE.md), więc pierwszy wpis z sekcji <c>ConnectionStrings</c> wystarcza — nie trzeba
    /// znać konkretnej nazwy, żeby wiedzieć, czy baza w ogóle odpowiada.
    /// </summary>
    private sealed class PostgresReadinessCheck(IConfiguration configuration) : IHealthCheck
    {
        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            var connectionString = configuration.GetSection("ConnectionStrings").GetChildren()
                .Select(entry => entry.Value)
                .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

            if (connectionString is null)
            {
                return HealthCheckResult.Unhealthy("Brak skonfigurowanego łańcucha połączenia do Postgresa.");
            }

            try
            {
                await using var connection = new NpgsqlConnection(connectionString);
                await connection.OpenAsync(cancellationToken).ConfigureAwait(false);

                return HealthCheckResult.Healthy();
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy("Postgres nie odpowiada.", ex);
            }
        }
    }
}
