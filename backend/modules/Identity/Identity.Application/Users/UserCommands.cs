using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using Identity.Application.Abstractions;
using Identity.Domain.Users;

namespace Identity.Application.Users;

/// <summary>Nadanie roli użytkownikowi. <see cref="GrantedBy"/> nie jest w żądaniu —
/// handler bierze go z <see cref="IExecutionContext.UserId"/> (kto woła), żeby nie dało się
/// podszyć pod innego admina przez sam payload.</summary>
public sealed class UserAssignRoleCommand : ICommand<Guid>
{
    public Guid UserUuid { get; set; }

    public Guid RoleUuid { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; }
}

public sealed class UserAssignRoleCommandHandler : CommandHandler<UserAssignRoleCommand, Guid>
{
    private readonly IUserAccountRepository _repository;
    private readonly IRoleRepository _roleRepository;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IUnitOfWork _unitOfWork;

    public UserAssignRoleCommandHandler(
        IUserAccountRepository repository,
        IRoleRepository roleRepository,
        IClock clock,
        IExecutionContext executionContext,
        IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _roleRepository = roleRepository;
        _clock = clock;
        _executionContext = executionContext;
        _unitOfWork = unitOfWork;
    }

    public override async Task<Guid> ExecuteAsync(UserAssignRoleCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var user = await _repository.FindAsync(command.UserUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(UserAccount), command.UserUuid);

        if (await _roleRepository.FindAsync(command.RoleUuid, ct).ConfigureAwait(false) is null)
        {
            throw new AggregateNotFoundException(nameof(Domain.Roles.Role), command.RoleUuid);
        }

        user.AssignRole(command.RoleUuid, _clock.UtcNow, _executionContext.UserId, command.ExpiresAt);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return user.Uuid;
    }
}

public sealed class UserRevokeRoleCommand : ICommand<Guid>
{
    public Guid UserUuid { get; set; }

    public Guid RoleUuid { get; set; }
}

public sealed class UserRevokeRoleCommandHandler : CommandHandler<UserRevokeRoleCommand, Guid>
{
    private readonly IUserAccountRepository _repository;
    private readonly IUnitOfWork _unitOfWork;

    public UserRevokeRoleCommandHandler(IUserAccountRepository repository, IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
    }

    public override async Task<Guid> ExecuteAsync(UserRevokeRoleCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var user = await _repository.FindAsync(command.UserUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(UserAccount), command.UserUuid);

        user.RevokeRole(command.RoleUuid);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return user.Uuid;
    }
}

/// <summary>Nadanie uprawnienia bezpośrednio użytkownikowi, z pominięciem ról —
/// <see cref="Reason"/> wymagany (patrz <c>UserAccount.GrantPermission</c>).</summary>
public sealed class UserGrantPermissionCommand : ICommand<Guid>
{
    public Guid UserUuid { get; set; }

    public string PermissionCode { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;
}

public sealed class UserGrantPermissionCommandHandler : CommandHandler<UserGrantPermissionCommand, Guid>
{
    private readonly IUserAccountRepository _repository;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IUnitOfWork _unitOfWork;

    public UserGrantPermissionCommandHandler(
        IUserAccountRepository repository, IClock clock, IExecutionContext executionContext, IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _clock = clock;
        _executionContext = executionContext;
        _unitOfWork = unitOfWork;
    }

    public override async Task<Guid> ExecuteAsync(UserGrantPermissionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var user = await _repository.FindAsync(command.UserUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(UserAccount), command.UserUuid);

        user.GrantPermission(command.PermissionCode, _clock.UtcNow, _executionContext.UserId, command.Reason);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return user.Uuid;
    }
}

public sealed class UserRevokePermissionCommand : ICommand<Guid>
{
    public Guid UserUuid { get; set; }

    public string PermissionCode { get; set; } = string.Empty;
}

public sealed class UserRevokePermissionCommandHandler : CommandHandler<UserRevokePermissionCommand, Guid>
{
    private readonly IUserAccountRepository _repository;
    private readonly IUnitOfWork _unitOfWork;

    public UserRevokePermissionCommandHandler(IUserAccountRepository repository, IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
    }

    public override async Task<Guid> ExecuteAsync(UserRevokePermissionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var user = await _repository.FindAsync(command.UserUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(UserAccount), command.UserUuid);

        user.RevokePermission(command.PermissionCode);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return user.Uuid;
    }
}
