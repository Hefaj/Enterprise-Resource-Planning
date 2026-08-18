using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Erp.BuildingBlocks.Api.Auth;

/// <summary>
/// Adres i identyfikator klienta Keycloaka — jedynego IdP w systemie. Autoryzacja (role,
/// uprawnienia) żyje w osobnym mikroserwisie Identity i NIE jest tu walidowana — ten plik
/// odpowiada wyłącznie za pytanie „kim jesteś", nie „co możesz" (patrz
/// <c>docs/backend/identity-authz.md</c> §1).
/// </summary>
public sealed class KeycloakOptions
{
    public const string SectionName = "Keycloak";

    /// <summary>Adres realmu, np. <c>http://localhost:8080/realms/erp</c>. Służy zarówno
    /// do walidacji podpisu tokenu (JWKS pod `{Authority}/.well-known/openid-configuration`),
    /// jak i do walidacji claimu <c>iss</c>.</summary>
    public string Authority { get; init; } = string.Empty;

    /// <summary>Identyfikator klienta SPA (<c>erp-client</c>) — musi zgadzać się z <c>aud</c>
    /// w tokenie. Keycloak domyślnie NIE dokłada <c>audience</c> bez dedykowanego mappera —
    /// patrz uwaga w <see cref="ErpAuthExtensions.AddErpAuth"/>.</summary>
    public string Audience { get; init; } = string.Empty;
}

/// <summary>
/// Uwierzytelnianie JWT wspólne dla wszystkich mikroserwisów. Rejestrowane z
/// <see cref="ErpApiExtensions.AddErpApi"/>, żeby żaden Program.cs nie mógł go pominąć —
/// tak samo jak CORS i FastEndpoints.
/// </summary>
public static class ErpAuthExtensions
{
    public static IServiceCollection AddErpAuth(this IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetSection(KeycloakOptions.SectionName).Get<KeycloakOptions>()
            ?? throw new InvalidOperationException(
                $"Brak sekcji konfiguracji '{KeycloakOptions.SectionName}' — bez adresu Keycloaka " +
                "serwis nie ma jak zweryfikować tokenów. Dodaj 'Keycloak:Authority' i 'Keycloak:Audience' " +
                "do appsettings.");

        if (string.IsNullOrWhiteSpace(options.Authority))
        {
            throw new InvalidOperationException($"'{KeycloakOptions.SectionName}:Authority' jest puste.");
        }

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(bearerOptions =>
            {
                bearerOptions.Authority = options.Authority;
                bearerOptions.Audience = options.Audience;

                // Dev: Keycloak w compose gada HTTP, nie HTTPS. Do zmiany, gdy realm dostanie TLS.
                bearerOptions.RequireHttpsMetadata = false;

                // Bez tego framework mapuje "sub" -> ClaimTypes.NameIdentifier i "preferred_username"
                // -> ClaimTypes.Name po staremu, co rozjeżdża się z resztą kodu (ExecutionContextMiddleware,
                // PermissionClaimsTransformation w Fazie 3) czytającą claimy Keycloaka wprost po nazwie.
                bearerOptions.MapInboundClaims = false;

                bearerOptions.TokenValidationParameters = new TokenValidationParameters
                {
                    NameClaimType = "preferred_username",
                    // Keycloak nie dokłada `aud` dla klienta SPA bez dedykowanego "audience mappera"
                    // w realmie — dopóki realm-erp.json go nie ma, wyłączamy walidację audience,
                    // żeby nie blokować startu. Włączyć razem z mapperem, gdy Identity zacznie
                    // wystawiać tokeny wieloserwisowe.
                    ValidateAudience = false,
                };

                // @microsoft/signalr przesyła token w query stringu (`access_token`), nie w nagłówku
                // `Authorization` — WebSocket/negocjacja SignalR nie pozwala na customowe nagłówki.
                // Dotyczy tylko Notification (jedyny serwis z hubem), ale rejestracja tu jest tania
                // i nie wymaga wiedzy o SignalR w BuildingBlocks.Api.
                bearerOptions.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;

                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                        {
                            context.Token = accessToken;
                        }

                        return Task.CompletedTask;
                    },
                };
            });

        // Bezpieczne domyślnie: każdy endpoint wymaga zalogowania, chyba że jawnie
        // oznaczony `AllowAnonymous()`. FastEndpoints mapuje endpointy przez routing
        // ASP.NET Core, więc fallback policy obejmuje je tak samo jak Minimal API.
        services.AddAuthorization(authOptions =>
        {
            authOptions.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
        });

        return services;
    }
}
