using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using Identity.Application.Permissions;

namespace Identity.Application.Roles;

/// <summary>
/// Wie, JAKIE reguły wsadowe obowiązują dla której operacji masowej na rolach.
///
/// <para><b>Dlaczego to jest w Application, a nie w endpoincie.</b> Patrz uzasadnienie przy
/// <c>Catalog.Application.Products.ProductBatchValidator</c> — ten sam powód: „które reguły
/// biznesowe stosujemy” to decyzja przypadku użycia, nie transportu.</para>
///
/// <para>Reguły są od siebie niezależne, więc wołamy je po kolei na tej samej pełnej liście,
/// bez <see cref="ValidationChain{T}"/> — zależy nam na zebraniu WSZYSTKICH naruszeń elementu
/// naraz.</para>
/// </summary>
public sealed class RoleBatchValidator
{
    private readonly RoleMustExistRule _roleMustExist;
    private readonly ReferencedRoleMustExistRule _referencedRoleMustExist;
    private readonly RoleCodeUniqueRule _roleCodeUnique;
    private readonly RoleGraphCycleRule _roleGraphCycle;
    private readonly PermissionCodeMustExistRule _permissionCodeMustExist;

    public RoleBatchValidator(
        RoleMustExistRule roleMustExist,
        ReferencedRoleMustExistRule referencedRoleMustExist,
        RoleCodeUniqueRule roleCodeUnique,
        RoleGraphCycleRule roleGraphCycle,
        PermissionCodeMustExistRule permissionCodeMustExist)
    {
        _roleMustExist = roleMustExist;
        _referencedRoleMustExist = referencedRoleMustExist;
        _roleCodeUnique = roleCodeUnique;
        _roleGraphCycle = roleGraphCycle;
        _permissionCodeMustExist = permissionCodeMustExist;
    }

    /// <summary>Pre-check masowego tworzenia ról: tylko unikalność kodu — cel jest NOWYM
    /// agregatem, więc reguła istnienia nie ma zastosowania.</summary>
    public async Task<ValidationTracker> ValidateCreateAsync(
        IReadOnlyList<BatchTarget<RoleCreateCommand>> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        var codeTargets = targets.Select(t => new RoleCreateTarget(t.AggregateUuid, t.Command.Code)).ToList();
        await _roleCodeUnique.ExecuteAsync(codeTargets, c => c.Uuid, tracker, cancellationToken).ConfigureAwait(false);

        return tracker;
    }

    /// <summary>Pre-check masowego nadania uprawnienia roli: rola-cel musi istnieć, a kod
    /// uprawnienia musi być znanym, nie wycofanym wpisem katalogu.</summary>
    public async Task<ValidationTracker> ValidateAddPermissionAsync(
        IReadOnlyList<BatchTarget<RoleAddPermissionCommand>> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        await _roleMustExist
            .ExecuteAsync([.. targets.Select(t => t.AggregateUuid).Distinct()], uuid => uuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        var codes = targets.Select(t => new PermissionCodeTarget(t.AggregateUuid, t.Command.PermissionCode)).ToList();
        await _permissionCodeMustExist
            .ExecuteAsync(codes, c => c.AggregateUuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        return tracker;
    }

    /// <summary>Pre-check masowego odebrania uprawnienia roli. Kod uprawnienia sam w sobie nie
    /// musi istnieć — usunięcie nieznanego kodu jest bezpiecznym no-opem — więc jedyną regułą
    /// jest istnienie roli.</summary>
    public Task<ValidationTracker> ValidateRemovePermissionAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
        => ValidateRoleExistenceAsync(aggregateUuids, cancellationToken);

    /// <summary>Pre-check masowego dołączenia roli składowej: kontener i składowa muszą istnieć,
    /// a nowa krawędź nie może zamknąć cyklu ani być samo-zawieraniem (patrz
    /// <see cref="RoleGraphCycleRule"/>).</summary>
    public async Task<ValidationTracker> ValidateAddMemberAsync(
        IReadOnlyList<BatchTarget<RoleAddMemberCommand>> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        await _roleMustExist
            .ExecuteAsync([.. targets.Select(t => t.AggregateUuid).Distinct()], uuid => uuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        var references = targets
            .Select(t => new RoleReferenceTarget(t.AggregateUuid, t.Command.MemberRoleUuid))
            .ToList();
        await _referencedRoleMustExist
            .ExecuteAsync(references, r => r.AggregateUuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        var edges = targets
            .Select(t => new RoleMemberTarget(t.AggregateUuid, t.Command.MemberRoleUuid))
            .ToList();
        await _roleGraphCycle
            .ExecuteAsync(edges, e => e.ContainerUuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        return tracker;
    }

    /// <summary>Pre-check masowego odłączenia roli składowej. Jak przy odebraniu uprawnienia —
    /// odłączenie nieobecnej składowej jest no-opem, więc tylko istnienie kontenera.</summary>
    public Task<ValidationTracker> ValidateRemoveMemberAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
        => ValidateRoleExistenceAsync(aggregateUuids, cancellationToken);

    private async Task<ValidationTracker> ValidateRoleExistenceAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(aggregateUuids);

        var tracker = new ValidationTracker();

        // Deduplikacja po agregacie: reguła istnienia pyta o byt celu, więc dwa razy ten sam
        // uuid to jedno pytanie. Błąd i tak trafi do wszystkich elementów tego agregatu,
        // bo `preValidatedFailures` jest słownikiem po uuid (patrz Job.Create).
        var uuids = aggregateUuids.Distinct().ToList();

        await _roleMustExist.ExecuteAsync(uuids, uuid => uuid, tracker, cancellationToken).ConfigureAwait(false);

        return tracker;
    }
}
