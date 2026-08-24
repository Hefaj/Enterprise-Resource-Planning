using Catalog.Application.Multimedia;
using Erp.BuildingBlocks.Validation;

namespace Catalog.Application.Products;

/// <summary>
/// Cel operacji dopięcia multimediów wraz z listą zasobów, które mają do niego trafić.
/// </summary>
/// <param name="Uuid">Produkt, do którego dopinamy.</param>
/// <param name="MultimediaUuids">Zasoby do dopięcia.</param>
public sealed record ProductMultimediaTarget(Guid Uuid, IReadOnlyList<Guid> MultimediaUuids);

/// <summary>
/// Reguła wsadowa: każdy dopinany zasób musi istnieć w katalogu.
///
/// <para><b>Dlaczego przed utworzeniem zadania, a nie w handlerze.</b> Nieistniejący plik nie
/// jest problemem pojedynczego produktu — jest problemem całego zlecenia, bo ta sama lista
/// plików idzie do wszystkich celów. Sprawdzenie w handlerze oznaczałoby tę samą odpowiedź
/// powtórzoną tyle razy, ile produktów, i to samo zadanie kończące się w całości błędem, tyle
/// że po przemieleniu wszystkich chunków. Tutaj użytkownik dowiaduje się od razu, przy 400.</para>
///
/// <para>Jedno zapytanie na sumę wszystkich list, nie na cel — przy „pięć plików do tysiąca
/// produktów" różnica to jedno zapytanie zamiast tysiąca identycznych.</para>
/// </summary>
public sealed class ProductMultimediaMustExistRule : IBatchRule<ProductMultimediaTarget>
{
    private readonly IMultimediaQueries _queries;

    public ProductMultimediaMustExistRule(IMultimediaQueries queries) => _queries = queries;

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<ProductMultimediaTarget> items,
        Func<ProductMultimediaTarget, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(idSelector);
        ArgumentNullException.ThrowIfNull(tracker);

        if (items.Count == 0)
        {
            return;
        }

        var referenced = items.SelectMany(t => t.MultimediaUuids).Distinct().ToList();

        if (referenced.Count == 0)
        {
            foreach (var item in items)
            {
                tracker.AddError(
                    idSelector(item),
                    "multimedia_empty",
                    "Nie wskazano żadnego pliku do dopięcia.");
            }

            return;
        }

        var existing = new HashSet<Guid>(
            await _queries.GetExistingUuidsAsync(referenced, cancellationToken).ConfigureAwait(false));

        foreach (var item in items)
        {
            var missing = item.MultimediaUuids.Where(uuid => !existing.Contains(uuid)).ToList();

            if (missing.Count > 0)
            {
                tracker.AddError(
                    idSelector(item),
                    "multimedia_not_found",
                    $"Nie znaleziono zasobów multimedialnych: {string.Join(", ", missing)}.");
            }
        }
    }
}
