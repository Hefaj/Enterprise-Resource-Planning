using Erp.BuildingBlocks.Validation;

namespace Identity.Application.Permissions;

/// <summary>Referencja do kodu uprawnienia wewnątrz komendy wykonywanej na INNYM agregacie —
/// błąd trafia do <see cref="AggregateUuid"/> (element zadania). Współdzielony przez
/// <c>UserGrantPermissionCommand.PermissionCode</c> (agregat = użytkownik) i
/// <c>RoleAddPermissionCommand.PermissionCode</c> (agregat = rola) — stąd generyczna nazwa
/// pola, nie <c>UserUuid</c>.</summary>
/// <param name="AggregateUuid">Element zadania, do którego trafi błąd.</param>
/// <param name="PermissionCode">Kod z <see cref="Erp.BuildingBlocks.Contracts.Permissions"/>.</param>
public sealed record PermissionCodeTarget(Guid AggregateUuid, string PermissionCode);

/// <summary>
/// Reguła wsadowa: kod uprawnienia musi istnieć w katalogu i nie być <c>IsObsolete</c>.
///
/// <para><b>To sprawdzenie NIE ma dziś odpowiednika w pojedynczej ścieżce komendy</b> —
/// ani <c>UserAccount.GrantPermission</c>, ani <c>Role.AddPermission</c> nie sprawdzają kodu.
/// Literówka zapisuje się do bazy jako martwy <c>permission_code</c>, którego żaden <c>if</c>
/// nigdy nie sprawdzi. Reguła wsadowa to pierwsza linia obrony przed tym błędem — jeden
/// <c>SELECT</c> na cały wsad.</para>
/// </summary>
public sealed class PermissionCodeMustExistRule : IBatchRule<PermissionCodeTarget>
{
    private readonly IPermissionCatalogQueries _queries;

    public PermissionCodeMustExistRule(IPermissionCatalogQueries queries)
    {
        _queries = queries;
    }

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<PermissionCodeTarget> items,
        Func<PermissionCodeTarget, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(tracker);

        if (items.Count == 0)
        {
            return;
        }

        var codes = items.Select(i => i.PermissionCode).Distinct(StringComparer.Ordinal).ToList();
        var existing = new HashSet<string>(
            await _queries.GetExistingCodesAsync(codes, cancellationToken).ConfigureAwait(false),
            StringComparer.Ordinal);

        foreach (var item in items)
        {
            if (!existing.Contains(item.PermissionCode))
            {
                tracker.AddError(
                    idSelector(item),
                    "permission_code_unknown",
                    $"Kod uprawnienia '{item.PermissionCode}' nie istnieje w katalogu albo jest wycofany.");
            }
        }
    }
}
