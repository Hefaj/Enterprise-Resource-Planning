using Erp.BuildingBlocks.Application.Abstractions;
using Identity.Application.Abstractions;
using Identity.Domain.Users;
using Identity.Infrastructure.Persistence;
using Identity.Infrastructure.Seed;
using Microsoft.EntityFrameworkCore;

namespace Identity.Api.Provisioning;

/// <summary>
/// Zakłada wiersz <c>user_account</c> przy pierwszym uwierzytelnionym żądaniu danego
/// użytkownika — Keycloak jest jedynym miejscem REJESTRACJI, ale Identity musi wiedzieć
/// o istnieniu użytkownika, zanim będzie miał do czego przypiąć role (patrz
/// <c>docs/backend/identity-authz.md</c> §5, "Provisioning JIT").
///
/// <para><b>Musi biec PRZED endpointami</b>, inaczej pierwsze wywołanie <c>GET /me/permissions</c>
/// zaraz po pierwszym logowaniu widziałoby jeszcze nieistniejącego użytkownika. Dlatego jest
/// podpięty przez <c>configureBeforeEndpoints</c> w <c>ErpApiExtensions.UseErpApi</c>, nie jako
/// zwykły <c>app.Use...</c> w Program.cs — ten hak gwarantuje kolejność względem
/// <c>ExecutionContextMiddleware</c> i <c>UseFastEndpoints</c>.</para>
///
/// <para><b>Pierwszy użytkownik systemu</b> dostaje automatycznie rolę
/// <see cref="RoleSeeder.AdministratorRoleCode"/> — bez tego nikt nie mógłby zalogować się
/// i zacząć nadawać ról komukolwiek innemu (kurczak i jajko przy starcie systemu).</para>
/// </summary>
public sealed class UserProvisioningMiddleware
{
    private readonly RequestDelegate _next;

    public UserProvisioningMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(
        HttpContext context,
        IdentityDbContext dbContext,
        IUserAccountRepository userRepository,
        IRoleRepository roleRepository,
        IClock clock,
        IUnitOfWork unitOfWork)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.User.Identity?.IsAuthenticated == true
            && Guid.TryParse(context.User.FindFirst("sub")?.Value, out var uuid)
            && await userRepository.FindAsync(uuid, context.RequestAborted).ConfigureAwait(false) is null)
        {
            var email = context.User.FindFirst("email")?.Value ?? string.Empty;
            var displayName = context.User.FindFirst("name")?.Value
                ?? context.User.FindFirst("preferred_username")?.Value
                ?? email;

            // Sprawdzane PRZED dodaniem nowego użytkownika do kontekstu — inaczej AnyAsync
            // widziałby już nasz własny, jeszcze niezapisany wiersz.
            var isFirstUser = !await dbContext.UserAccounts.AnyAsync(context.RequestAborted).ConfigureAwait(false);

            var user = UserAccount.ProvisionFromToken(uuid, email, displayName, clock.UtcNow);

            if (isFirstUser)
            {
                var administratorRole = await roleRepository
                    .FindByCodeAsync(RoleSeeder.AdministratorRoleCode, context.RequestAborted)
                    .ConfigureAwait(false);

                if (administratorRole is not null)
                {
                    user.AssignRole(administratorRole.Uuid, clock.UtcNow, grantedBy: null, expiresAt: null);
                }
            }

            userRepository.Add(user);
            await unitOfWork.SaveChangesAsync(context.RequestAborted).ConfigureAwait(false);
        }

        await _next(context).ConfigureAwait(false);
    }
}
