using Erp.BuildingBlocks.Application.Messaging;
using Microsoft.AspNetCore.Authentication;
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
    public static IServiceCollection AddErpAuth(
        this IServiceCollection services, IConfiguration configuration, bool enablePermissionClaims = true)
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

        if (enablePermissionClaims)
        {
            AddErpPermissions(services, configuration);
        }

        return services;
    }

    /// <summary>
    /// Rejestruje <see cref="IKeycloakAdminClient"/> — dziś wołane wyłącznie z
    /// <c>Identity.Api/Program.cs</c> (wymuszone wylogowanie, Faza 6). Osobna metoda, nie
    /// część <see cref="AddErpAuth"/>, bo żaden inny mikroserwis nie potrzebuje Admin API
    /// Keycloaka — płacenie za rejestrację HttpClienta, którego się nie używa, byłoby
    /// niepotrzebnym kosztem startu.
    /// </summary>
    public static IServiceCollection AddErpKeycloakAdmin(this IServiceCollection services, IConfiguration configuration)
    {
        var adminOptions = configuration.GetSection(KeycloakAdminOptions.SectionName).Get<KeycloakAdminOptions>()
            ?? throw new InvalidOperationException(
                $"Brak sekcji konfiguracji '{KeycloakAdminOptions.SectionName}' — bez adresu i " +
                "poświadczeń service-account Identity nie ma jak wołać Admin API Keycloaka. Dodaj " +
                "'KeycloakAdmin:AuthServerUrl/Realm/ClientId/ClientSecret' do appsettings.");

        if (string.IsNullOrWhiteSpace(adminOptions.AuthServerUrl))
        {
            throw new InvalidOperationException($"'{KeycloakAdminOptions.SectionName}:AuthServerUrl' jest puste.");
        }

        services.Configure<KeycloakAdminOptions>(configuration.GetSection(KeycloakAdminOptions.SectionName));

        services.AddHttpClient(KeycloakAdminClient.HttpClientName, client =>
        {
            client.BaseAddress = new Uri(adminOptions.AuthServerUrl);
            client.Timeout = TimeSpan.FromSeconds(5);
        });

        services.AddSingleton<IKeycloakAdminClient, KeycloakAdminClient>();

        return services;
    }

    /// <summary>
    /// Faza 3 — dokłada claimy <c>permissions</c> zaraz po uwierzytelnieniu, żeby
    /// <c>Permissions(...)</c> na endpointach FastEndpoints miało czym sprawdzać (patrz
    /// <see cref="PermissionClaimsTransformation"/>). Wywoływane z <see cref="AddErpAuth"/>,
    /// nie osobno — nie ma scenariusza, w którym mikroserwis chciałby AuthN bez tego haka.
    /// </summary>
    private static void AddErpPermissions(IServiceCollection services, IConfiguration configuration)
    {
        var identityOptions = configuration.GetSection(IdentityServiceOptions.SectionName).Get<IdentityServiceOptions>()
            ?? throw new InvalidOperationException(
                $"Brak sekcji konfiguracji '{IdentityServiceOptions.SectionName}' — bez adresu mikroserwisu " +
                "Identity serwis nie ma skąd pobrać uprawnień. Dodaj 'Identity:BaseUrl' do appsettings.");

        if (string.IsNullOrWhiteSpace(identityOptions.BaseUrl))
        {
            throw new InvalidOperationException($"'{IdentityServiceOptions.SectionName}:BaseUrl' jest puste.");
        }

        services.AddMemoryCache();
        services.AddHttpContextAccessor();
        services.AddHttpClient(HttpPermissionProvider.IdentityHttpClientName, client =>
        {
            client.BaseAddress = new Uri(identityOptions.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(5);
        });

        // Konkretny typ, nie tylko interfejs: ta sama instancja odpowiada za dwie role —
        // czytanie uprawnień i przyjmowanie broadcastu unieważnień. Gdyby były rejestrowane
        // osobno, unieważnienie trafiałoby do innego obiektu niż ten, który trzyma cache.
        //
        // Identity nadpisuje IPermissionProvider własną implementacją in-process; wpis
        // IPermissionCacheInvalidator zostaje wtedy bez zajęcia i nie robi nic — u siebie
        // Identity czyta bazę wprost, więc nie ma czego unieważniać.
        services.AddSingleton<HttpPermissionProvider>();
        services.AddSingleton<IPermissionProvider>(sp => sp.GetRequiredService<HttpPermissionProvider>());
        services.AddSingleton<IPermissionCacheInvalidator>(sp => sp.GetRequiredService<HttpPermissionProvider>());
        services.AddTransient<IClaimsTransformation, PermissionClaimsTransformation>();
    }
}
