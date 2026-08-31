using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;

namespace Erp.BuildingBlocks.Api.Auth;

/// <summary>
/// Dokłada claimy <c>permissions</c> (jeden na kod) do <see cref="ClaimsPrincipal"/> zaraz po
/// walidacji JWT — FastEndpoints czyta dokładnie ten typ claimu w metodzie <c>Permissions(...)</c>
/// wołanej w <c>Configure()</c> endpointu (domyślna nazwa, konfigurowalna przez
/// <c>c.Security.PermissionsClaimType</c>, tu zostawiona domyślna).
///
/// Token Keycloaka NIE niesie uprawnień — to świadomie odseparowane od AuthN (patrz
/// <c>docs/backend/identity-authz.md</c> §1): ten transformator dociąga je z
/// <see cref="IPermissionProvider"/> (Identity + cache TTL) przy każdym żądaniu.
///
/// <para><b>Wołane wielokrotnie na żądanie.</b> ASP.NET Core może wywołać
/// <see cref="TransformAsync"/> więcej niż raz w cyklu życia jednego żądania — znacznik
/// <c>erp_permissions_loaded</c> na zwróconym principalu chroni przed powtórnym, zbędnym
/// zapytaniem do <see cref="IPermissionProvider"/> (który i tak ma własny cache, ale unikamy
/// nawet kosztu odpytania cache'u).</para>
/// </summary>
public sealed class PermissionClaimsTransformation : IClaimsTransformation
{
    /// <summary>Publiczny, bo <c>ExecutionContextMiddleware</c> czyta ten sam typ claimu, żeby
    /// wypełnić <c>IExecutionContext.Permissions</c> bez drugiego, rozjeżdżającego się literału.</summary>
    internal const string PermissionsClaimType = "permissions";
    private const string LoadedMarkerClaimType = "erp_permissions_loaded";

    private readonly IPermissionProvider _permissionProvider;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public PermissionClaimsTransformation(IPermissionProvider permissionProvider, IHttpContextAccessor httpContextAccessor)
    {
        _permissionProvider = permissionProvider;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        ArgumentNullException.ThrowIfNull(principal);

        if (principal.Identity?.IsAuthenticated != true
            || principal.HasClaim(c => c.Type == LoadedMarkerClaimType))
        {
            return principal;
        }

        var userId = principal.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(userId))
        {
            return principal;
        }

        // Token TEGO żądania, przekazywany dalej do wywołania serwis-do-serwisu w Identity —
        // patrz uzasadnienie przy IPermissionProvider.GetPermissionsAsync.
        var authorizationHeader = _httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        var bearerToken = authorizationHeader?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
            ? authorizationHeader["Bearer ".Length..]
            : null;

        // Wariant przyjmujący cały principal — pozwala implementacjom in-process (Identity)
        // wykonać JIT provisioning przed odczytem efektywnych uprawnień, patrz uzasadnienie
        // na IPermissionProvider.GetPermissionsAsync(ClaimsPrincipal, ...).
        var permissions = await _permissionProvider.GetPermissionsAsync(principal, bearerToken, CancellationToken.None)
            .ConfigureAwait(false);

        var identity = new ClaimsIdentity();
        identity.AddClaim(new Claim(LoadedMarkerClaimType, "1"));
        foreach (var permission in permissions)
        {
            identity.AddClaim(new Claim(PermissionsClaimType, permission));
        }

        principal.AddIdentity(identity);
        return principal;
    }
}
