using Erp.BuildingBlocks.Api.Contracts;
using Erp.BuildingBlocks.Validation;
using Identity.Application.Permissions;
using Identity.Application.Roles;

namespace Identity.Application.Users;

/// <summary>
/// Wie, JAKIE reguły wsadowe obowiązują dla której operacji masowej na użytkownikach.
///
/// <para><b>Dlaczego to jest w Application, a nie w endpoincie.</b> Patrz uzasadnienie przy
/// <c>Catalog.Application.Products.ProductBatchValidator</c> — ten sam powód: „które reguły
/// biznesowe stosujemy” to decyzja przypadku użycia, nie transportu.</para>
///
/// <para>Reguły są od siebie niezależne (istnienie użytkownika vs istnienie referencji), więc
/// wołamy je po kolei na tej samej pełnej liście, bez <see cref="ValidationChain{T}"/> —
/// zależy nam na zebraniu WSZYSTKICH naruszeń elementu naraz.</para>
/// </summary>
public sealed class UserBatchValidator : IBatchValidator
{
    private readonly UserMustExistRule _userMustExist;
    private readonly ReferencedRoleMustExistRule _referencedRoleMustExist;
    private readonly PermissionCodeMustExistRule _permissionCodeMustExist;

    public UserBatchValidator(
        UserMustExistRule userMustExist,
        ReferencedRoleMustExistRule referencedRoleMustExist,
        PermissionCodeMustExistRule permissionCodeMustExist)
    {
        _userMustExist = userMustExist;
        _referencedRoleMustExist = referencedRoleMustExist;
        _permissionCodeMustExist = permissionCodeMustExist;
    }

    /// <summary>Pre-check masowego nadania roli: użytkownik-cel i referencyjna rola muszą
    /// istnieć.</summary>
    public async Task<ValidationTracker> ValidateAssignRoleAsync(
        IReadOnlyList<BatchTarget<UserAssignRoleCommand>> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        await _userMustExist
            .ExecuteAsync([.. targets.Select(t => t.AggregateUuid).Distinct()], uuid => uuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        var references = targets.Select(t => new RoleReferenceTarget(t.AggregateUuid, t.Command.RoleUuid)).ToList();
        await _referencedRoleMustExist
            .ExecuteAsync(references, r => r.AggregateUuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        return tracker;
    }

    /// <summary>Pre-check masowego odebrania roli. Rola sama w sobie nie musi istnieć —
    /// <c>UserAccount.RevokeRole</c> jest bezpiecznym no-opem, gdy grant nie istnieje (patrz
    /// dzisiejszy handler synchroniczny), więc jedyną regułą wsadową jest istnienie użytkownika.</summary>
    public Task<ValidationTracker> ValidateRevokeRoleAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
        => ValidateUserExistenceAsync(aggregateUuids, cancellationToken);

    /// <summary>Pre-check masowego nadania uprawnienia: użytkownik-cel musi istnieć, a kod
    /// uprawnienia musi być znanym, nie wycofanym wpisem katalogu.</summary>
    public async Task<ValidationTracker> ValidateGrantPermissionAsync(
        IReadOnlyList<BatchTarget<UserGrantPermissionCommand>> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        await _userMustExist
            .ExecuteAsync([.. targets.Select(t => t.AggregateUuid).Distinct()], uuid => uuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        var codes = targets.Select(t => new PermissionCodeTarget(t.AggregateUuid, t.Command.PermissionCode)).ToList();
        await _permissionCodeMustExist
            .ExecuteAsync(codes, c => c.AggregateUuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        return tracker;
    }

    /// <summary>Pre-check masowego odebrania uprawnienia. Jak przy odebraniu roli — odbieranie
    /// nieistniejącego grantu jest no-opem, więc tylko istnienie użytkownika.</summary>
    public Task<ValidationTracker> ValidateRevokePermissionAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
        => ValidateUserExistenceAsync(aggregateUuids, cancellationToken);

    /// <summary>Pre-check masowego wymuszenia wylogowania — tylko istnienie użytkownika;
    /// odwołanie sesji Keycloak jest idempotentne, więc nie ma tu drugiej reguły.</summary>
    public Task<ValidationTracker> ValidateForceLogoutAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
        => ValidateUserExistenceAsync(aggregateUuids, cancellationToken);

    private async Task<ValidationTracker> ValidateUserExistenceAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(aggregateUuids);

        var tracker = new ValidationTracker();

        // Deduplikacja po agregacie: reguła istnienia pyta o byt celu, więc dwa razy ten sam
        // uuid to jedno pytanie. Błąd i tak trafi do wszystkich elementów tego agregatu,
        // bo `preValidatedFailures` jest słownikiem po uuid (patrz Job.Create).
        var uuids = aggregateUuids.Distinct().ToList();

        await _userMustExist.ExecuteAsync(uuids, uuid => uuid, tracker, cancellationToken).ConfigureAwait(false);

        return tracker;
    }
}
