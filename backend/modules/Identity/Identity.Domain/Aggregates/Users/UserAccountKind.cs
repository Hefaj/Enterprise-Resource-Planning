namespace Identity.Domain.Users;

/// <summary>
/// Rodzaj podmiotu, dla którego istnieje wiersz <see cref="UserAccount"/>. Wprowadzone przez
/// API-003 ("klucz integracyjny") — patrz <c>docs/architecture/security.md</c> §2.
///
/// <para><b>Human</b> — projekcja człowieka zakładana JIT przy logowaniu przez Keycloak
/// (<see cref="UserAccount.ProvisionFromToken"/>).</para>
///
/// <para><b>Service</b> — konto reprezentujące poufnego klienta Keycloaka z
/// <c>client_credentials</c> (grant maszyna-do-maszyny), zakładane jawnie przez administratora
/// przez <c>IntegrationClientCreateCommand</c> (<see cref="UserAccount.CreateServiceAccount"/>),
/// nie JIT. Token <c>client_credentials</c> niesie ten sam claim <c>sub</c> co token logowania
/// człowieka, więc reszta pipeline'u AuthN→AuthZ (transformacja claimów, CTE efektywnych
/// uprawnień) działa dla obu rodzajów bez żadnej zmiany.</para>
/// </summary>
public enum UserAccountKind
{
    Human = 0,
    Service = 1,
}
