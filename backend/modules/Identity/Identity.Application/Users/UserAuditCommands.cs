using Erp.BuildingBlocks.Api.Auth;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using Identity.Application.Abstractions;
using Identity.Domain.Audit;
using Identity.Domain.Users;

namespace Identity.Application.Users;

/// <summary>
/// Wymuszone wylogowanie — odrębny plik od <see cref="UserCommands"/>, bo ta komenda nie
/// zmienia stanu agregatu <see cref="UserAccount"/> (żadna metoda domenowa), tylko woła
/// dwa systemy zewnętrzne (Keycloak Admin API, cache uprawnień) i zostawia ślad audytowy —
/// inny kształt niż reszta komend w tym module (patrz <c>docs/backend/identity-authz.md</c>
/// Faza 6).
/// </summary>
public sealed class UserForceLogoutCommand : ICommand<Guid>
{
    public Guid UserUuid { get; set; }
}

public sealed class UserForceLogoutCommandHandler : CommandHandler<UserForceLogoutCommand, Guid>
{
    private readonly IUserAccountRepository _repository;
    private readonly IKeycloakAdminClient _keycloakAdminClient;
    private readonly IPermissionProvider _permissionProvider;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IGrantAuditWriter _auditWriter;
    private readonly IUnitOfWork _unitOfWork;

    public UserForceLogoutCommandHandler(
        IUserAccountRepository repository,
        IKeycloakAdminClient keycloakAdminClient,
        IPermissionProvider permissionProvider,
        IClock clock,
        IExecutionContext executionContext,
        IGrantAuditWriter auditWriter,
        IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _keycloakAdminClient = keycloakAdminClient;
        _permissionProvider = permissionProvider;
        _clock = clock;
        _executionContext = executionContext;
        _auditWriter = auditWriter;
        _unitOfWork = unitOfWork;
    }

    public override async Task<Guid> ExecuteAsync(UserForceLogoutCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var user = await _repository.FindAsync(command.UserUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(UserAccount), command.UserUuid);

        // Uuid użytkownika JEST claimem `sub` Keycloaka (patrz komentarz klasy UserAccount) —
        // nie ma osobnej kolumny "keycloak sub" do przekazania dalej.
        var userSub = user.Uuid.ToString();

        await _keycloakAdminClient.RevokeUserSessionsAsync(userSub, ct).ConfigureAwait(false);
        await _permissionProvider.InvalidateAsync(userSub, ct).ConfigureAwait(false);

        await _auditWriter.RecordAsync(
            GrantAuditEntry.Create(
                _clock.UtcNow, UserAssignRoleCommandHandler.ActorUuid(_executionContext), "user", user.Uuid,
                "user_forced_logout", userSub, reason: null, source: "identity.api"),
            ct).ConfigureAwait(false);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return user.Uuid;
    }
}
