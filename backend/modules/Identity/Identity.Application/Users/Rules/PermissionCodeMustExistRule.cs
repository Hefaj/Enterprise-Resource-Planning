using Erp.BuildingBlocks.Validation;
using Identity.Application.Permissions;

namespace Identity.Application.Users;

/// <summary>Element wsadu <c>user/batch-grant-permission</c>: użytkownik-cel i kod uprawnienia,
/// które komenda chce mu nadać bezpośrednio.</summary>
/// <param name="UserUuid">Agregat, do którego trafi błąd.</param>
/// <param name="PermissionCode">Kod z <see cref="Erp.BuildingBlocks.Contracts.Permissions"/>.</param>
public sealed record PermissionCodeTarget(Guid UserUuid, string PermissionCode);

/// <summary>
/// Reguła wsadowa: kod uprawnienia musi istnieć w katalogu i nie być <c>IsObsolete</c>.
///
/// <para><b>To sprawdzenie NIE ma dziś odpowiednika w pojedynczej ścieżce komendy</b> —
/// <c>UserAccount.GrantPermission</c> przyjmuje dowolny string. Literówka w kodzie zapisuje się
/// do bazy jako martwy <c>permission_code</c>, którego żaden <c>if</c> nigdy nie sprawdzi. Reguła
/// wsadowa to pierwsza linia obrony przed tym błędem — jeden <c>SELECT</c> na cały wsad.</para>
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
