namespace Catalog.Domain.Categories;

/// <summary>
/// Wiersz tabeli domknięcia drzewa kategorii: para (przodek, potomek) wraz z odległością.
/// Każdy węzeł ma też wiersz do samego siebie z <see cref="Depth"/> = 0.
///
/// <para>Po co to istnieje: przy drzewie rzędu setek tysięcy węzłów rekurencyjne chodzenie po
/// <c>ParentUuid</c> jest nie do utrzymania. Metadane, których wymaga <c>erp-tree</c> w trybie
/// server (<c>hasChildren</c>, <c>childCount</c>, <c>descendantCount</c>) sprowadzają się tu do
/// jednego zapytania agregującego zamiast rekurencyjnego zliczania w pamięci, które w wersji
/// mockowej kosztowało 9 sekund na jedno stronicowane zapytanie.</para>
///
/// <para>Rozstrzyganie zaznaczenia z <c>TreeSelectionRequest</c> również sprowadza się do
/// jednego <c>JOIN</c>: „potomkowie zaznaczonych korzeni minus wykluczenia”, bez materializowania
/// listy identyfikatorów w treści żądania.</para>
///
/// <para>To nie jest agregat ani encja domenowa w sensie biznesowym — to indeks pochodny,
/// w całości wyliczalny z <see cref="Category.ParentUuid"/>. Utrzymuje go infrastruktura
/// przy zapisie kategorii; nie ma własnych reguł ani cyklu życia.</para>
/// </summary>
public sealed class CategoryClosureEntry
{
    /// <summary>Konstruktor dla EF Core.</summary>
    private CategoryClosureEntry()
    {
    }

    public CategoryClosureEntry(Guid ancestorUuid, Guid descendantUuid, int depth)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(depth);

        AncestorUuid = ancestorUuid;
        DescendantUuid = descendantUuid;
        Depth = depth;
    }

    public Guid AncestorUuid { get; private set; }

    public Guid DescendantUuid { get; private set; }

    /// <summary>Odległość w krawędziach; 0 oznacza wiersz węzła do samego siebie.</summary>
    public int Depth { get; private set; }
}
