using System.Security.Claims;
using Erp.BuildingBlocks.Application.Abstractions;
using Identity.Application.Abstractions;
using Identity.Domain.Users;
using Identity.Infrastructure.Persistence;
using Identity.Infrastructure.Seed;
using Microsoft.EntityFrameworkCore;

namespace Identity.Infrastructure.Provisioning;

/// <inheritdoc cref="IUserProvisioningService" />
public sealed class UserProvisioningService : IUserProvisioningService
{
    private readonly IdentityDbContext _dbContext;
    private readonly IUserAccountRepository _userRepository;
    private readonly IRoleRepository _roleRepository;
    private readonly IClock _clock;
    private readonly IUnitOfWork _unitOfWork;

    public UserProvisioningService(
        IdentityDbContext dbContext,
        IUserAccountRepository userRepository,
        IRoleRepository roleRepository,
        IClock clock,
        IUnitOfWork unitOfWork)
    {
        _dbContext = dbContext;
        _userRepository = userRepository;
        _roleRepository = roleRepository;
        _clock = clock;
        _unitOfWork = unitOfWork;
    }

    public async Task EnsureProvisionedAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(principal);

        if (principal.Identity?.IsAuthenticated != true
            || !Guid.TryParse(principal.FindFirst("sub")?.Value, out var uuid)
            || await _userRepository.FindAsync(uuid, cancellationToken).ConfigureAwait(false) is not null)
        {
            return;
        }

        var email = principal.FindFirst("email")?.Value ?? string.Empty;
        var displayName = principal.FindFirst("name")?.Value
            ?? principal.FindFirst("preferred_username")?.Value
            ?? email;

        // Sprawdzane PRZED dodaniem nowego użytkownika do kontekstu — inaczej AnyAsync
        // widziałby już nasz własny, jeszcze niezapisany wiersz. Liczymy WYŁĄCZNIE konta
        // Kind=Human — jeśli admin zarejestruje klucz integracyjny (Kind=Service) przed
        // pierwszym logowaniem człowieka, pierwszy prawdziwy user nadal musi dostać rolę
        // administrator automatycznie (patrz API-003, docs/architecture/security.md §2).
        var isFirstUser = !await _dbContext.UserAccounts
            .AnyAsync(u => u.Kind == UserAccountKind.Human, cancellationToken)
            .ConfigureAwait(false);

        var user = UserAccount.ProvisionFromToken(uuid, email, displayName, _clock.UtcNow);

        if (isFirstUser)
        {
            var administratorRole = await _roleRepository
                .FindByCodeAsync(RoleSeeder.AdministratorRoleCode, cancellationToken)
                .ConfigureAwait(false);

            if (administratorRole is not null)
            {
                user.AddRole(administratorRole.Uuid, _clock.UtcNow, grantedBy: null, expiresAt: null);
            }
        }

        _userRepository.Add(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
