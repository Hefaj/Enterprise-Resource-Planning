using Erp.BuildingBlocks.Validation;

namespace Identity.Application.Roles;

/// <summary>
/// Reguła wsadowa: cel operacji masowej musi być istniejącą rolą.
///
/// Jedno zapytanie (<see cref="IRoleQueries.GetExistingUuidsAsync"/>) na CAŁY zbiór celów,
/// nie jedno na element. Odrzucenie tutaj niesie ten sam kod błędu (<c>aggregate_not_found</c>),
/// którym <c>AggregateNotFoundException</c> posługuje się w pojedynczej ścieżce komendy.
/// </summary>
public sealed class RoleMustExistRule : IBatchRule<Guid>
{
    private readonly IRoleQueries _queries;

    public RoleMustExistRule(IRoleQueries queries)
    {
        _queries = queries;
    }

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<Guid> items,
        Func<Guid, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(tracker);

        if (items.Count == 0)
        {
            return;
        }

        var existing = new HashSet<Guid>(
            await _queries.GetExistingUuidsAsync(items, cancellationToken).ConfigureAwait(false));

        foreach (var item in items)
        {
            var uuid = idSelector(item);

            if (!existing.Contains(uuid))
            {
                tracker.AddError(uuid, "aggregate_not_found", $"Nie znaleziono roli o identyfikatorze {uuid}.");
            }
        }
    }
}
