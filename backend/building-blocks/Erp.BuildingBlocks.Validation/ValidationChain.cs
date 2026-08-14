namespace Erp.BuildingBlocks.Validation;

/// <summary>
/// Wykonuje reguły wsadowe w kolejności, w trybie Chain of Responsibility / Pipes and Filters —
/// dla reguł silnie od siebie zależnych, gdzie kolejny krok zakłada, że poprzedni przeszedł.
///
/// Element, który nie przejdzie kroku, jest odfiltrowywany i kolejne reguły w łańcuchu go
/// ignorują. To chroni system przed wyjątkami technicznymi (np. <see cref="NullReferenceException"/>) —
/// reguła sprawdzająca, czy kategoria jest aktywna, nie musi sama pilnować, że kategoria
/// w ogóle istnieje, jeśli <c>CategoryMustExistRule</c> stoi przed nią w tym samym łańcuchu.
///
/// Dla reguł płaskich, niezależnych od siebie, gdzie zależy na zebraniu WSZYSTKICH błędów
/// dla elementu naraz, łańcuch jest zbędny — woła się <see cref="IBatchRule{T}.ExecuteAsync"/>
/// bezpośrednio, po kolei, na tej samej pełnej liście wejściowej.
/// </summary>
/// <typeparam name="T">Typ elementu wsadu.</typeparam>
public sealed class ValidationChain<T>
{
    private readonly Func<T, Guid> _idSelector;
    private readonly List<IBatchRule<T>> _rules = [];

    /// <param name="idSelector">Jak wydobyć identyfikator agregatu z elementu wsadu —
    /// ten sam selektor jest przekazywany każdej regule i służy do odfiltrowywania
    /// elementów, które już zebrały błąd we wcześniejszym kroku.</param>
    public ValidationChain(Func<T, Guid> idSelector)
    {
        ArgumentNullException.ThrowIfNull(idSelector);
        _idSelector = idSelector;
    }

    /// <summary>Dokłada regułę na koniec łańcucha. Zwraca <c>this</c> dla stylu fluent.</summary>
    public ValidationChain<T> AddRule(IBatchRule<T> rule)
    {
        ArgumentNullException.ThrowIfNull(rule);
        _rules.Add(rule);
        return this;
    }

    /// <summary>
    /// Przepuszcza <paramref name="items"/> przez kolejne reguły. Po każdym kroku odfiltrowuje
    /// elementy, które właśnie zebrały błąd — one NIE trafiają do kolejnej reguły łańcucha.
    /// </summary>
    public async Task RunAsync(
        IReadOnlyList<T> items,
        ValidationTracker tracker,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(tracker);

        var remaining = items;

        foreach (var rule in _rules)
        {
            if (remaining.Count == 0)
            {
                break;
            }

            await rule.ExecuteAsync(remaining, _idSelector, tracker, cancellationToken).ConfigureAwait(false);

            remaining = [.. remaining.Where(item => !tracker.HasError(_idSelector(item)))];
        }
    }
}
