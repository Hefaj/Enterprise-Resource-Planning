using Catalog.Application.Contracts;
using Catalog.Domain.Products;
using Erp.BuildingBlocks.Validation;

namespace Catalog.Application.Products;

/// <summary>
/// Klasyfikacja, którą komenda chce nadać produktowi — wejście reguły duplikatu.
///
/// Lekki typ wsadu, nie agregat: reguła musi zobaczyć WARTOŚCI DOCELOWE (co zostanie
/// ustawione), a nie stan zapisany w bazie. Pytanie „czy ten produkt jest teraz duplikatem”
/// jest bezużyteczne — interesuje nas, czy stanie się nim po wykonaniu komendy.
/// </summary>
/// <param name="Uuid">Produkt, którego dotyczy komenda.</param>
/// <param name="ModelUuid">Model do ustawienia; <c>null</c> wyłącza produkt z reguły.</param>
/// <param name="CategoryUuids">Komplet kategorii do ustawienia.</param>
public sealed record ProductClassificationTarget(
    Guid Uuid,
    Guid? ModelUuid,
    IReadOnlyList<Guid> CategoryUuids);

/// <summary>
/// Reguła wsadowa: dwa produkty nie mogą mieć tego samego modelu i tego samego kompletu
/// kategorii.
///
/// <para><b>To nie jest gwarancja, tylko jej szybka zapowiedź.</b> Właściwym egzekutorem
/// reguły jest unikalny indeks <c>ix_product_duplicate_key</c> — między tym pre-checkiem
/// a wykonaniem chunka przez <c>BulkCommandRunner</c> mija dowolnie dużo czasu i równoległe
/// żądanie może w tym oknie zająć sygnaturę. Ta klasa istnieje po to, żeby użytkownik
/// dostał „1200 pozycji odrzuconych jako duplikaty” od razu razem z <c>jobUuid</c>, zamiast
/// dowiadywać się tego samego po czterech minutach z raportu zakończonego zadania.</para>
///
/// <para>Koszt: JEDNO zapytanie na cały wsad, niezależnie od liczby celów.</para>
/// </summary>
public sealed class ProductDuplicateRule : IBatchRule<ProductClassificationTarget>
{
    private readonly IProductQueries _queries;

    public ProductDuplicateRule(IProductQueries queries)
    {
        _queries = queries;
    }

    /// <inheritdoc />
    public async Task ExecuteAsync(
        IReadOnlyList<ProductClassificationTarget> items,
        Func<ProductClassificationTarget, Guid> idSelector,
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

        // Ta sama funkcja, którą agregat policzy sygnaturę przy zapisie — gdyby reguła liczyła
        // klucz po swojemu, odpytywałaby bazę o wartości, których zapis nigdy nie wygeneruje.
        var keys = items
            .Select(item => Product.ComputeDuplicateKey(item.ModelUuid, item.CategoryUuids))
            .ToList();

        var distinctKeys = keys.Where(k => k is not null).Select(k => k!).Distinct(StringComparer.Ordinal).ToList();

        if (distinctKeys.Count == 0)
        {
            return;
        }

        var owners = await _queries
            .GetOwnersByDuplicateKeysAsync(distinctKeys, cancellationToken)
            .ConfigureAwait(false);

        // Kolizje WEWNĄTRZ wsadu. Bez tego wsad ustawiający ten sam model i te same kategorie
        // na 500 produktach przeszedłby pre-check w całości (żaden z nich nie koliduje z bazą),
        // a rozbił się dopiero o unikalny indeks — po jednym elemencie naraz, w trybie izolacji
        // BulkCommandRunnera. Zasada: pierwszy zgłaszający sygnaturę ją zajmuje.
        var claimed = new Dictionary<string, Guid>(StringComparer.Ordinal);

        for (var i = 0; i < items.Count; i++)
        {
            var key = keys[i];

            // Produkt bez modelu nie uczestniczy w regule — w bazie ma duplicate_key = NULL,
            // a częściowy indeks go nie obejmuje.
            if (key is null)
            {
                continue;
            }

            var uuid = idSelector(items[i]);

            if (owners.TryGetValue(key, out var owner) && owner != uuid)
            {
                tracker.AddError(
                    uuid,
                    "product_duplicate",
                    $"Produkt o tym samym modelu i kategoriach już istnieje ({owner}).");
                continue;
            }

            if (claimed.TryGetValue(key, out var claimant) && claimant != uuid)
            {
                tracker.AddError(
                    uuid,
                    "product_duplicate",
                    $"Ta sama klasyfikacja jest w tym samym zadaniu nadawana produktowi {claimant}.");
                continue;
            }

            claimed[key] = uuid;
        }
    }
}
