using Erp.BuildingBlocks.Validation;
using Identity.Application.Roles;

namespace Identity.Application.Users;

/// <summary>Element wsadu <c>user/batch-assign-role</c>: użytkownik-cel i rola, którą komenda
/// chce mu nadać. Lekki typ, nie <c>BatchTarget&lt;UserAssignRoleCommand&gt;</c> wprost — reguła
/// nie potrzebuje reszty komendy (<c>ExpiresAt</c>), tylko dwóch identyfikatorów.</summary>
/// <param name="UserUuid">Agregat, do którego trafi błąd — to on jest celem elementu zadania.</param>
/// <param name="RoleUuid">Rola wskazana w komendzie, której istnienie sprawdzamy.</param>
public sealed record RoleReferenceTarget(Guid UserUuid, Guid RoleUuid);

/// <summary>
/// Reguła wsadowa: rola wskazana w komendzie (np. <c>UserAssignRoleCommand.RoleUuid</c>) musi
/// istnieć. Odpowiednik sprawdzenia, które dziś robi <c>UserAssignRoleCommandHandler</c> przez
/// <c>IRoleRepository.FindAsync</c> per element — tutaj jedno zbiorcze zapytanie na cały wsad.
///
/// Błąd trafia do UŻYTKOWNIKA (elementu zadania), nie do roli — to użytkownik jest agregatem,
/// którego dotyczy `job_item`, rola jest tylko referencją w payloadzie.
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
