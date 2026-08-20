using Erp.BuildingBlocks.Validation;

namespace Identity.Application.Roles;

/// <summary>Referencja do roli wewnątrz komendy wykonywanej na INNYM agregacie —
/// błąd trafia do <see cref="AggregateUuid"/> (element zadania), rola jest tylko wartością
/// w payloadzie. Współdzielony przez dwa przypadki użycia: <c>UserAssignRoleCommand.RoleUuid</c>
/// (agregat = użytkownik) i <c>RoleAddMemberCommand.MemberRoleUuid</c> (agregat = rola-kontener)
/// — stąd generyczna nazwa pola, nie <c>UserUuid</c>.</summary>
/// <param name="AggregateUuid">Element zadania, do którego trafi błąd.</param>
/// <param name="RoleUuid">Rola wskazana w komendzie, której istnienie sprawdzamy.</param>
public sealed record RoleReferenceTarget(Guid AggregateUuid, Guid RoleUuid);

/// <summary>
/// Reguła wsadowa: rola wskazana w komendzie musi istnieć. Odpowiednik sprawdzenia, które
/// dziś robią <c>UserAssignRoleCommandHandler</c> i <c>RoleAddMemberCommandHandler</c> przez
/// <c>IRoleRepository.FindAsync</c> per element — tutaj jedno zbiorcze zapytanie na cały wsad.
/// </summary>
public sealed class ReferencedRoleMustExistRule : IBatchRule<RoleReferenceTarget>
{
    private readonly IRoleQueries _queries;

    public ReferencedRoleMustExistRule(IRoleQueries queries)
    {
        _queries = queries;
    }

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<RoleReferenceTarget> items,
        Func<RoleReferenceTarget, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(tracker);

        if (items.Count == 0)
        {
            return;
        }

        var roleUuids = items.Select(i => i.RoleUuid).Distinct().ToList();
        var existing = new HashSet<Guid>(
            await _queries.GetExistingUuidsAsync(roleUuids, cancellationToken).ConfigureAwait(false));

        foreach (var item in items)
        {
            if (!existing.Contains(item.RoleUuid))
            {
                tracker.AddError(
                    idSelector(item),
                    "aggregate_not_found",
                    $"Nie znaleziono roli o identyfikatorze {item.RoleUuid}.");
            }
        }
    }
}
