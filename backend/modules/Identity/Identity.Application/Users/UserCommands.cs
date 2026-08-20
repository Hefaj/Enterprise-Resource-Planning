using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using Identity.Application.Abstractions;
using Identity.Domain.Audit;
using Identity.Domain.Users;

namespace Identity.Application.Users;

/// <summary>Nadanie roli użytkownikowi. <see cref="GrantedBy"/> nie jest w żądaniu —
/// handler bierze go z <see cref="IExecutionContext.UserId"/> (kto woła), żeby nie dało się
/// podszyć pod innego admina przez sam payload.
///
/// <para><c>Uuid</c> (nie <c>UserUuid</c>) — nazwa wymagana przez <see cref="IAggregateCommand"/>:
/// <c>BulkCommandRunner</c> podstawia tu identyfikator elementu zadania. Patrz Faza 1
/// w <c>docs/backend/identity-bulk-migration.md</c>.</para></summary>
public sealed class UserAssignRoleCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid RoleUuid { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; }
}

/// <summary>Handler NIE woła <c>IUnitOfWork.SaveChangesAsync</c> — od Fazy 1/2 przejścia na
/// operacje masowe granicę transakcji wyznacza <c>BulkCommandRunner</c> (jeden zapis na cały
/// chunk), tak samo jak w Catalogu.</summary>
public sealed class UserAssignRoleCommandHandler : CommandHandler<UserAssignRoleCommand, Guid>
{
    private readonly IUserAccountRepository _repository;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IGrantAuditWriter _auditWriter;

    public UserAssignRoleCommandHandler(
        IUserAccountRepository repository,
        IClock clock,
        IExecutionContext executionContext,
        IGrantAuditWriter auditWriter)
    {
        _repository = repository;
        _clock = clock;
        _executionContext = executionContext;
        _auditWriter = auditWriter;
    }

    public override async Task<Guid> ExecuteAsync(UserAssignRoleCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var user = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(UserAccount), command.Uuid);

        var now = _clock.UtcNow;
        user.AssignRole(command.RoleUuid, now, _executionContext.UserId, command.ExpiresAt);

        await _auditWriter.RecordAsync(
            GrantAuditEntry.Create(
                now, ActorUuid(_executionContext), "user", user.Uuid,
                "role_assigned", command.RoleUuid.ToString(), reason: null, source: "identity.api"),
            ct).ConfigureAwait(false);

        return user.Uuid;
    }

    internal static Guid ActorUuid(IExecutionContext executionContext)
        => Guid.TryParse(executionContext.UserId, out var actorUuid) ? actorUuid : Guid.Empty;
}

public sealed class UserRevokeRoleCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid RoleUuid { get; set; }
}

public sealed class UserRevokeRoleCommandHandler : CommandHandler<UserRevokeRoleCommand, Guid>
{
    private readonly IUserAccountRepository _repository;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IGrantAuditWriter _auditWriter;

    public UserRevokeRoleCommandHandler(
        IUserAccountRepository repository,
        IClock clock,
        IExecutionContext executionContext,
        IGrantAuditWriter auditWriter)
    {
        _repository = repository;
        _clock = clock;
        _executionContext = executionContext;
        _auditWriter = auditWriter;
    }

    public override async Task<Guid> ExecuteAsync(UserRevokeRoleCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var user = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(UserAccount), command.Uuid);

        user.RevokeRole(command.RoleUuid);

        await _auditWriter.RecordAsync(
            GrantAuditEntry.Create(
                _clock.UtcNow, UserAssignRoleCommandHandler.ActorUuid(_executionContext), "user", user.Uuid,
                "role_revoked", command.RoleUuid.ToString(), reason: null, source: "identity.api"),
            ct).ConfigureAwait(false);

        return user.Uuid;
    }
}

/// <summary>Nadanie uprawnienia bezpośrednio użytkownikowi, z pominięciem ról —
/// <see cref="Reason"/> wymagany (patrz <c>UserAccount.GrantPermission</c>).</summary>
public sealed class UserGrantPermissionCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string PermissionCode { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;
}

public sealed class UserGrantPermissionCommandHandler : CommandHandler<UserGrantPermissionCommand, Guid>
{
    private readonly IUserAccountRepository _repository;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IGrantAuditWriter _auditWriter;

    public UserGrantPermissionCommandHandler(
        IUserAccountRepository repository,
        IClock clock,
        IExecutionContext executionContext,
        IGrantAuditWriter auditWriter)
    {
        _repository = repository;
        _clock = clock;
        _executionContext = executionContext;
        _auditWriter = auditWriter;
    }

    public override async Task<Guid> ExecuteAsync(UserGrantPermissionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var user = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(UserAccount), command.Uuid);

        var now = _clock.UtcNow;
        user.GrantPermission(command.PermissionCode, now, _executionContext.UserId, command.Reason);

        await _auditWriter.RecordAsync(
            GrantAuditEntry.Create(
                now, UserAssignRoleCommandHandler.ActorUuid(_executionContext), "user", user.Uuid,
                "permission_granted", command.PermissionCode, command.Reason, source: "identity.api"),
            ct).ConfigureAwait(false);

        return user.Uuid;
    }
}

public sealed class UserRevokePermissionCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string PermissionCode { get; set; } = string.Empty;
}

public sealed class UserRevokePermissionCommandHandler : CommandHandler<UserRevokePermissionCommand, Guid>
{
    private readonly IUserAccountRepository _repository;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IGrantAuditWriter _auditWriter;

    public UserRevokePermissionCommandHandler(
        IUserAccountRepository repository,
        IClock clock,
        IExecutionContext executionContext,
        IGrantAuditWriter auditWriter)
    {
        _repository = repository;
        _clock = clock;
        _executionContext = executionContext;
        _auditWriter = auditWriter;
    }

    public override async Task<Guid> ExecuteAsync(UserRevokePermissionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var user = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(UserAccount), command.Uuid);

        user.RevokePermission(command.PermissionCode);

        await _auditWriter.RecordAsync(
            GrantAuditEntry.Create(
                _clock.UtcNow, UserAssignRoleCommandHandler.ActorUuid(_executionContext), "user", user.Uuid,
                "permission_revoked", command.PermissionCode, reason: null, source: "identity.api"),
            ct).ConfigureAwait(false);

        return user.Uuid;
    }
}
