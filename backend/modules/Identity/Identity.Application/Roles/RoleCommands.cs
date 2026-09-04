using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Application.Abstractions;
using Erp.BuildingBlocks.Domain;
using FastEndpoints;
using Identity.Application.Abstractions;
using Identity.Domain.Audit;
using Identity.Domain.Roles;

namespace Identity.Application.Roles;

/// <summary>
/// Komendy Identity obsługujące operacje masowe (patrz <c>docs/guides/backend/bulk-commands.md</c>)
/// komendy modułu Identity idą tą samą drogą co Catalog/Sales: przez
/// <c>BatchEndpointBase</c>/<c>BulkCommandRunner</c>. Handlery NIE wołają
/// <c>IUnitOfWork.SaveChangesAsync</c> — granicę transakcji wyznacza runner (jeden zapis na
/// cały chunk), inaczej N elementów jednego chunka dałoby N commitów i popsuło częściowy sukces.
/// </summary>
public sealed class RoleCreateCommand : ICommand<Guid>, IAggregateCommand
{
    /// <summary>Uuid generowany przez klienta — tworzenie roli ma sens wyłącznie w trybie
    /// <c>Commands[]</c> (agregat jeszcze nie istnieje, więc nie ma czego wskazać filtrem
    /// ani listą identyfikatorów).</summary>
    public Guid Uuid { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }
}

public sealed class RoleCreateCommandHandler : CommandHandler<RoleCreateCommand, Guid>
{
    private readonly IRoleRepository _repository;

    public RoleCreateCommandHandler(IRoleRepository repository)
    {
        _repository = repository;
    }

    public override Task<Guid> ExecuteAsync(RoleCreateCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        // Duplikat kodu wewnątrz wsadu i względem bazy odsiewa RoleCodeUniqueRule PRZED
        // utworzeniem zadania — to sprawdzenie zostaje jako druga linia obrony dla ścieżek,
        // które kiedyś ominą pre-check (patrz batch-validation.md).
        var role = Role.CreateWithUuid(command.Uuid, command.Code, command.Name, command.Description);
        _repository.Add(role);

        return Task.FromResult(role.Uuid);
    }
}

public sealed class RoleAddPermissionCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string PermissionCode { get; set; } = string.Empty;
}

public sealed class RoleAddPermissionCommandHandler : CommandHandler<RoleAddPermissionCommand, Guid>
{
    private readonly IRoleRepository _repository;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IGrantAuditWriter _auditWriter;

    public RoleAddPermissionCommandHandler(
        IRoleRepository repository,
        IClock clock,
        IExecutionContext executionContext,
        IGrantAuditWriter auditWriter)
    {
        _repository = repository;
        _clock = clock;
        _executionContext = executionContext;
        _auditWriter = auditWriter;
    }

    public override async Task<Guid> ExecuteAsync(RoleAddPermissionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var role = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Role), command.Uuid);

        role.AddPermission(command.PermissionCode);

        await _auditWriter.RecordAsync(
            GrantAuditEntry.Create(
                _clock.UtcNow, ActorUuid(_executionContext), "role", role.Uuid,
                "role_permission_added", command.PermissionCode, reason: null, source: "identity.api"),
            ct).ConfigureAwait(false);

        return role.Uuid;
    }

    internal static Guid ActorUuid(IExecutionContext executionContext)
        => Guid.TryParse(executionContext.UserId, out var actorUuid) ? actorUuid : Guid.Empty;
}

public sealed class RoleRemovePermissionCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public string PermissionCode { get; set; } = string.Empty;
}

public sealed class RoleRemovePermissionCommandHandler : CommandHandler<RoleRemovePermissionCommand, Guid>
{
    private readonly IRoleRepository _repository;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IGrantAuditWriter _auditWriter;

    public RoleRemovePermissionCommandHandler(
        IRoleRepository repository,
        IClock clock,
        IExecutionContext executionContext,
        IGrantAuditWriter auditWriter)
    {
        _repository = repository;
        _clock = clock;
        _executionContext = executionContext;
        _auditWriter = auditWriter;
    }

    public override async Task<Guid> ExecuteAsync(RoleRemovePermissionCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var role = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Role), command.Uuid);

        role.RemovePermission(command.PermissionCode);

        await _auditWriter.RecordAsync(
            GrantAuditEntry.Create(
                _clock.UtcNow, RoleAddPermissionCommandHandler.ActorUuid(_executionContext), "role", role.Uuid,
                "role_permission_removed", command.PermissionCode, reason: null, source: "identity.api"),
            ct).ConfigureAwait(false);

        return role.Uuid;
    }
}

public sealed class RoleAddMemberCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid MemberRoleUuid { get; set; }
}

/// <summary>Jedyny handler w module, który MUSI zapytać bazę przed wywołaniem metody agregatu —
/// walidacja cyklu. Od Fazy 3 to DRUGA linia obrony: pierwsza (i jedyna skuteczna WEWNĄTRZ
/// jednego wsadu) jest <c>RoleGraphCycleRule</c> w pre-checku, bo <c>IsDescendantAsync</c>
/// czyta stan zacommitowany i nie widzi krawędzi z wcześniejszych elementów tego samego chunka
/// (patrz <c>docs/guides/backend/batch-validation.md</c>).</summary>
public sealed class RoleAddMemberCommandHandler : CommandHandler<RoleAddMemberCommand, Guid>
{
    private readonly IRoleRepository _repository;
    private readonly IRoleQueries _queries;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IGrantAuditWriter _auditWriter;

    public RoleAddMemberCommandHandler(
        IRoleRepository repository,
        IRoleQueries queries,
        IClock clock,
        IExecutionContext executionContext,
        IGrantAuditWriter auditWriter)
    {
        _repository = repository;
        _queries = queries;
        _clock = clock;
        _executionContext = executionContext;
        _auditWriter = auditWriter;
    }

    public override async Task<Guid> ExecuteAsync(RoleAddMemberCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        if (command.Uuid == command.MemberRoleUuid)
        {
            throw new DomainException("role_self_membership", "Rola nie może zawierać samej siebie.");
        }

        var container = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Role), command.Uuid);

        if (await _repository.FindAsync(command.MemberRoleUuid, ct).ConfigureAwait(false) is null)
        {
            throw new AggregateNotFoundException(nameof(Role), command.MemberRoleUuid);
        }

        // Czy MemberRoleUuid (kandydat) już transitywnie zawiera Uuid (kontener)? Jeśli tak,
        // dodanie go tutaj zamknęłoby cykl — patrz komentarz interfejsu IRoleQueries.
        var wouldCreateCycle = await _queries
            .IsDescendantAsync(command.MemberRoleUuid, command.Uuid, ct)
            .ConfigureAwait(false);

        if (wouldCreateCycle)
        {
            throw new DomainException(
                "role_cycle_detected",
                $"Dodanie roli {command.MemberRoleUuid} do {command.Uuid} utworzyłoby cykl.");
        }

        container.AddMember(command.MemberRoleUuid, cycleCheckedByCaller: true);

        await _auditWriter.RecordAsync(
            GrantAuditEntry.Create(
                _clock.UtcNow, RoleAddPermissionCommandHandler.ActorUuid(_executionContext), "role", container.Uuid,
                "role_member_added", command.MemberRoleUuid.ToString(), reason: null, source: "identity.api"),
            ct).ConfigureAwait(false);

        return container.Uuid;
    }
}

public sealed class RoleRemoveMemberCommand : ICommand<Guid>, IAggregateCommand
{
    public Guid Uuid { get; set; }

    public Guid MemberRoleUuid { get; set; }
}

public sealed class RoleRemoveMemberCommandHandler : CommandHandler<RoleRemoveMemberCommand, Guid>
{
    private readonly IRoleRepository _repository;
    private readonly IClock _clock;
    private readonly IExecutionContext _executionContext;
    private readonly IGrantAuditWriter _auditWriter;

    public RoleRemoveMemberCommandHandler(
        IRoleRepository repository,
        IClock clock,
        IExecutionContext executionContext,
        IGrantAuditWriter auditWriter)
    {
        _repository = repository;
        _clock = clock;
        _executionContext = executionContext;
        _auditWriter = auditWriter;
    }

    public override async Task<Guid> ExecuteAsync(RoleRemoveMemberCommand command, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(command);

        var container = await _repository.FindAsync(command.Uuid, ct).ConfigureAwait(false)
            ?? throw new AggregateNotFoundException(nameof(Role), command.Uuid);

        container.RemoveMember(command.MemberRoleUuid);

        await _auditWriter.RecordAsync(
            GrantAuditEntry.Create(
                _clock.UtcNow, RoleAddPermissionCommandHandler.ActorUuid(_executionContext), "role", container.Uuid,
                "role_member_removed", command.MemberRoleUuid.ToString(), reason: null, source: "identity.api"),
            ct).ConfigureAwait(false);

        return container.Uuid;
    }
}
