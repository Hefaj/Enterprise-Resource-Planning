using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using Identity.Application.Abstractions;
using Identity.Domain.Roles;

namespace Identity.Application.Roles;

/// <summary>
/// Komendy modułu Identity NIE przechodzą przez <c>BatchEndpointBase</c>/<c>BulkCommandRunner</c>
/// (patrz <c>docs/backend/identity-authz.md</c> §7 Faza 2 — zarządzanie rolami to niskowolumenowe
/// akcje administracyjne, nie operacje masowe na tysiącach rekordów). Dlatego, inaczej niż
/// handlery w Catalog/Sales, handlery tutaj SAME wołają <see cref="IUnitOfWork.SaveChangesAsync"/>
/// — nie ma runnera, który wyznaczyłby granicę transakcji za nie. Endpoint w Api tylko
/// wywołuje handler, nic więcej.
/// </summary>
public sealed class RoleCreateCommand : ICommand<Guid>
{
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
}

public sealed class RoleCreateCommandHandler : CommandHandler<RoleCreateCommand, Guid>
{
    private readonly IRoleRepository _repository;
    private readonly IUnitOfWork _unitOfWork;

    public RoleCreateCommandHandler(IRoleRepository repository, IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
    }

    public override async Task<Guid> ExecuteAsync(RoleCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (await _repository.FindByCodeAsync(command.Code, ct).ConfigureAwait(false) is not null)
        {
            throw new DomainException("role_code_duplicate", $"Rola o kodzie '{command.Code}' już istnieje.");
        }

        var role = Role.Create(command.Code, command.Name, command.Description);
        _repository.Add(role);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return role.Uuid;
    }
}

public sealed class RoleAddPermissionCommand : ICommand<Guid>
{
    public Guid RoleUuid { get; set; }

    public string PermissionCode { get; set; } = string.Empty;
}

public sealed class RoleAddPermissionCommandHandler : CommandHandler<RoleAddPermissionCommand, Guid>
{
    private readonly IRoleRepository _repository;
    private readonly IUnitOfWork _unitOfWork;

    public RoleAddPermissionCommandHandler(IRoleRepository repository, IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
    }

    public override async Task<Guid> ExecuteAsync(RoleAddPermissionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var role = await _repository.FindAsync(command.RoleUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Role), command.RoleUuid);

        role.AddPermission(command.PermissionCode);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return role.Uuid;
    }
}

public sealed class RoleRemovePermissionCommand : ICommand<Guid>
{
    public Guid RoleUuid { get; set; }

    public string PermissionCode { get; set; } = string.Empty;
}

public sealed class RoleRemovePermissionCommandHandler : CommandHandler<RoleRemovePermissionCommand, Guid>
{
    private readonly IRoleRepository _repository;
    private readonly IUnitOfWork _unitOfWork;

    public RoleRemovePermissionCommandHandler(IRoleRepository repository, IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
    }

    public override async Task<Guid> ExecuteAsync(RoleRemovePermissionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var role = await _repository.FindAsync(command.RoleUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Role), command.RoleUuid);

        role.RemovePermission(command.PermissionCode);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return role.Uuid;
    }
}

public sealed class RoleAddMemberCommand : ICommand<Guid>
{
    public Guid ContainerRoleUuid { get; set; }

    public Guid MemberRoleUuid { get; set; }
}

/// <summary>Jedyny handler w module, który MUSI zapytać bazę przed wywołaniem metody agregatu —
/// walidacja cyklu (patrz <c>Role.AddMember</c> i <c>IRoleQueries.IsDescendantAsync</c>).</summary>
public sealed class RoleAddMemberCommandHandler : CommandHandler<RoleAddMemberCommand, Guid>
{
    private readonly IRoleRepository _repository;
    private readonly IRoleQueries _queries;
    private readonly IUnitOfWork _unitOfWork;

    public RoleAddMemberCommandHandler(IRoleRepository repository, IRoleQueries queries, IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _queries = queries;
        _unitOfWork = unitOfWork;
    }

    public override async Task<Guid> ExecuteAsync(RoleAddMemberCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (command.ContainerRoleUuid == command.MemberRoleUuid)
        {
            throw new DomainException("role_self_membership", "Rola nie może zawierać samej siebie.");
        }

        var container = await _repository.FindAsync(command.ContainerRoleUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Role), command.ContainerRoleUuid);

        if (await _repository.FindAsync(command.MemberRoleUuid, ct).ConfigureAwait(false) is null)
        {
            throw new AggregateNotFoundException(nameof(Role), command.MemberRoleUuid);
        }

        // Czy MemberRoleUuid (kandydat) już transitywnie zawiera ContainerRoleUuid? Jeśli tak,
        // dodanie go tutaj zamknęłoby cykl — patrz komentarz interfejsu IRoleQueries.
        var wouldCreateCycle = await _queries
            .IsDescendantAsync(command.MemberRoleUuid, command.ContainerRoleUuid, ct)
            .ConfigureAwait(false);

        if (wouldCreateCycle)
        {
            throw new DomainException(
                "role_cycle_detected",
                $"Dodanie roli {command.MemberRoleUuid} do {command.ContainerRoleUuid} utworzyłoby cykl.");
        }

        container.AddMember(command.MemberRoleUuid, cycleCheckedByCaller: true);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return container.Uuid;
    }
}

public sealed class RoleRemoveMemberCommand : ICommand<Guid>
{
    public Guid ContainerRoleUuid { get; set; }

    public Guid MemberRoleUuid { get; set; }
}

public sealed class RoleRemoveMemberCommandHandler : CommandHandler<RoleRemoveMemberCommand, Guid>
{
    private readonly IRoleRepository _repository;
    private readonly IUnitOfWork _unitOfWork;

    public RoleRemoveMemberCommandHandler(IRoleRepository repository, IUnitOfWork unitOfWork)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
    }

    public override async Task<Guid> ExecuteAsync(RoleRemoveMemberCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var container = await _repository.FindAsync(command.ContainerRoleUuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Role), command.ContainerRoleUuid);

        container.RemoveMember(command.MemberRoleUuid);

        await _unitOfWork.SaveChangesAsync(ct).ConfigureAwait(false);

        return container.Uuid;
    }
}
