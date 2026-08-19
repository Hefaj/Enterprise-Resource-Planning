using System.Security.Claims;
using Erp.BuildingBlocks.Api.Auth;
using Identity.Application.Abstractions;
using Identity.Application.Users;
using Microsoft.AspNetCore.Authentication;

namespace Identity.Api.Auth;

/// <summary>
/// <see cref="IPermissionProvider"/> Identity używa własnej bazy wprost, zamiast HTTP + cache
/// TTL jak <see cref="HttpPermissionProvider"/> — Identity JEST źródłem prawdy o uprawnieniach,
/// więc pytanie samo siebie przez sieć byłoby tylko opóźnieniem bez żadnej korzyści (a naiwnie
/// zrobione, kończy się nieskończoną rekurencją — patrz uzasadnienie w
/// <c>ErpApiExtensions.AddErpApi</c>, parametr <c>enablePermissionClaims</c>).
///
/// <para><b>JIT provisioning tutaj, nie w middleware.</b> Wariant przyjmujący
/// <see cref="ClaimsPrincipal"/> woła <see cref="IUserProvisioningService.EnsureProvisionedAsync"/>
/// PRZED odczytem efektywnych uprawnień — <c>PermissionClaimsTransformation</c>
/// (<see cref="IClaimsTransformation"/>) biegnie zaraz po walidacji JWT, czyli wcześniej niż
/// jakikolwiek middleware wpięty przez <c>configureBeforeEndpoints</c>. Dawny
/// <c>UserProvisioningMiddleware</c> biegł za późno: pierwsze żądanie nowego użytkownika
/// widziałoby jeszcze nieistniejące konto w chwili odczytu uprawnień.</para>
/// </summary>
public sealed class IdentityInProcessPermissionProvider : IPermissionProvider
{
    private readonly IUserProvisioningService _provisioningService;
    private readonly IUserAccountQueries _queries;

    public IdentityInProcessPermissionProvider(IUserProvisioningService provisioningService, IUserAccountQueries queries)
    {
        _provisioningService = provisioningService;
        _queries = queries;
    }

    /// <summary>Wariant bez principala — bez JIT provisioning, tylko odczyt. Identity zawsze
    /// przechodzi przez wariant <see cref="ClaimsPrincipal"/> poniżej (wołany z
    /// <c>PermissionClaimsTransformation</c>); ten zostaje jako poprawna, ale "chudsza"
    /// implementacja interfejsu dla ewentualnych innych wywołujących.</summary>
    public async Task<IReadOnlyCollection<string>> GetPermissionsAsync(
        string userId, string? bearerToken, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(userId, out var uuid))
        {
            return [];
        }

        var codes = await _queries.GetEffectivePermissionCodesAsync(uuid, cancellationToken).ConfigureAwait(false);
        return codes.ToList();
    }

    public async Task<IReadOnlyCollection<string>> GetPermissionsAsync(
        ClaimsPrincipal principal, string? bearerToken, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(principal);

        await _provisioningService.EnsureProvisionedAsync(principal, cancellationToken).ConfigureAwait(false);

        var userId = principal.FindFirst("sub")?.Value;
        if (!Guid.TryParse(userId, out var uuid))
        {
            return [];
        }

        var codes = await _queries.GetEffectivePermissionCodesAsync(uuid, cancellationToken).ConfigureAwait(false);
        return codes.ToList();
    }

    /// <inheritdoc />
    public Task InvalidateAsync(string userId, CancellationToken cancellationToken)
        // Brak cache'u do wyczyszczenia — ten provider zawsze czyta bazę wprost.
        => Task.CompletedTask;
}
