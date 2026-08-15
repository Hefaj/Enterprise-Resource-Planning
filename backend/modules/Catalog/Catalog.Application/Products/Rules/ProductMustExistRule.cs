using Erp.BuildingBlocks.Validation;

namespace Catalog.Application.Products;

/// <summary>
/// Reguła wsadowa: cel operacji masowej musi być istniejącym produktem.
///
/// Jedno zapytanie (<see cref="IProductQueries.GetExistingUuidsAsync"/>) na CAŁY zbiór celów,
/// nie jedno na element — inaczej odsianie nieistniejących uuidów przy tysiącach celów kosztuje
/// tysiące zapytań, które i tak kończą się tym samym `AggregateNotFoundException`.
///
/// Odrzucenie tutaj (przed utworzeniem zadania) niesie ten sam kod błędu, którym
/// `AggregateNotFoundException` posługuje się w pojedynczej ścieżce komendy — raport
/// z operacji masowej wygląda identycznie niezależnie od tego, na którym etapie element odpadł.
/// </summary>
public sealed class ProductMustExistRule : IBatchRule<Guid>
{
    private readonly IProductQueries _queries;

    public ProductMustExistRule(IProductQueries queries)
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
                tracker.AddError(uuid, "aggregate_not_found", $"Nie znaleziono produktu o identyfikatorze {uuid}.");
            }
        }
    }
}
