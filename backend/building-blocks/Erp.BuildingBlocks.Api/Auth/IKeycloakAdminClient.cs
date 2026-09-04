namespace Erp.BuildingBlocks.Api.Auth;

/// <summary>
/// Wąski wycinek Admin API Keycloaka potrzebny Identity — dziś tylko wymuszone wylogowanie
/// (patrz <c>docs/architecture/security.md</c> Faza 6, <c>UserExecForceLogoutCommand</c>).
/// </summary>
public interface IKeycloakAdminClient
{
    /// <summary>Unieważnia wszystkie aktywne sesje danego użytkownika w Keycloaku —
    /// <c>POST /admin/realms/{realm}/users/{id}/logout</c>. Kolejne żądanie z jego starym
    /// tokenem dostępu nadal przejdzie AuthN, dopóki token nie wygaśnie (Keycloak nie unieważnia
    /// już wydanych access tokenów, tylko sesję/refresh token) — to ograniczenie standardowego
    /// przepływu OIDC, nie luka w tej implementacji.</summary>
    /// <param name="keycloakUserSub">Claim <c>sub</c> użytkownika — ten sam identyfikator,
    /// którym Identity adresuje <c>UserAccount.Uuid</c>.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    Task RevokeUserSessionsAsync(string keycloakUserSub, CancellationToken cancellationToken);
}
