using System.Security.Claims;

namespace Identity.Application.Abstractions;

/// <summary>
/// Zakłada wiersz <c>user_account</c> przy pierwszym uwierzytelnionym żądaniu danego
/// użytkownika (JIT provisioning) — wydzielone z dawnego <c>UserProvisioningMiddleware</c>
/// (patrz <c>docs/backend/identity-authz.md</c> Faza 6) tak, żeby ten sam kod dało się wywołać
/// z <c>IdentityInProcessPermissionProvider</c> PRZED odczytem efektywnych uprawnień —
/// middleware biegł zbyt późno względem <c>IClaimsTransformation</c>
/// (<c>PermissionClaimsTransformation</c> woła <c>IPermissionProvider</c> zaraz po walidacji
/// JWT, czyli PRZED jakimkolwiek middleware'em wpiętym przez <c>configureBeforeEndpoints</c>).
/// </summary>
public interface IUserProvisioningService
{
    /// <summary>Bezpieczne wywołać wielokrotnie na to samo żądanie — no-op, jeśli użytkownik
    /// już istnieje.</summary>
    Task EnsureProvisionedAsync(ClaimsPrincipal principal, CancellationToken cancellationToken);
}
