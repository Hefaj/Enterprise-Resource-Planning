namespace Erp.BuildingBlocks.Api.Auth;

/// <summary>
/// Poświadczenia service-account klienta <c>erp-identity-service</c>, używane wyłącznie przez
/// <see cref="IKeycloakAdminClient"/> do wymuszonego wylogowania (patrz
/// <c>docs/backend/identity-authz.md</c> Faza 6). Dziś rejestrowane tylko w
/// <c>Identity.Api</c> — inne mikroserwisy nie potrzebują Admin API Keycloaka.
/// </summary>
public sealed class KeycloakAdminOptions
{
    public const string SectionName = "KeycloakAdmin";

    /// <summary>Adres serwera Keycloak, np. <c>http://localhost:8080</c> — bez <c>/realms/{realm}</c>,
    /// to dokłada <see cref="KeycloakAdminClient"/> osobno dla tokenu i dla Admin API.</summary>
    public string AuthServerUrl { get; init; } = string.Empty;

    public string Realm { get; init; } = string.Empty;

    public string ClientId { get; init; } = string.Empty;

    public string ClientSecret { get; init; } = string.Empty;
}
