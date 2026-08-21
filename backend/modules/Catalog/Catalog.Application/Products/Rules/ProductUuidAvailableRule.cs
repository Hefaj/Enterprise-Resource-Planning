using Erp.BuildingBlocks.Validation;

namespace Catalog.Application.Products;

/// <summary>
/// Reguła wsadowa zakładania produktów: identyfikator nowego produktu musi być wolny.
///
/// <para>Lustrzane odbicie <see cref="ProductMustExistRule"/> — tam cel MUSI istnieć, tu
/// nie może. Powód jest praktyczny, nie symetria: uuid nadaje klient, a próba wstawienia
/// zajętego klucza głównego wywraca CAŁY chunk (jedna transakcja na 500 pozycji), zamiast
/// odrzucić samą kolidującą pozycję. Częściowy sukces stoi na tym, że <c>DomainException</c>
/// nie zanieczyszcza transakcji — naruszenie klucza w bazie tej własności nie ma.</para>
///
/// <para>Koszt: JEDNO zapytanie na cały wsad (<see cref="IProductQueries.GetExistingUuidsAsync"/>),
/// niezależnie od liczby zakładanych produktów.</para>
///
/// <para>Jak każdy pre-check jest to szybka zapowiedź, a nie gwarancja — ostatnią linią obrony
/// zostaje klucz główny tabeli <c>product</c>.</para>
/// </summary>
public sealed class ProductUuidAvailableRule : IBatchRule<Guid>
{
    private readonly IProductQueries _queries;

    public ProductUuidAvailableRule(IProductQueries queries)
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
        ArgumentNullException.ThrowIfNull(idSelector);
        ArgumentNullException.ThrowIfNull(tracker);

        if (items.Count == 0)
        {
            return;
        }

        // Powtórzenia WEWNĄTRZ wsadu. Nie „pierwszy wygrywa" jak przy duplikacie klasyfikacji:
        // `preValidatedFailures` jest słownikiem po uuid, więc dla dwóch pozycji o tym samym
        // identyfikatorze nie da się odrzucić tylko jednej. Odrzucamy obie — użytkownik dostaje
        // jasny sygnał, że wsad jest niespójny, zamiast losowo utworzonego jednego z dwóch
        // produktów o różnych nazwach.
        var seen = new HashSet<Guid>();
        var duplicated = new HashSet<Guid>();
        foreach (var uuid in items.Select(idSelector))
        {
            if (!seen.Add(uuid))
            {
                duplicated.Add(uuid);
            }
        }

        var existing = new HashSet<Guid>(
            await _queries.GetExistingUuidsAsync([.. seen], cancellationToken).ConfigureAwait(false));

        foreach (var uuid in seen)
        {
            if (uuid == Guid.Empty)
            {
                tracker.AddError(uuid, "product_uuid_required", "Identyfikator nowego produktu jest wymagany.");
                continue;
            }

            if (existing.Contains(uuid))
            {
                tracker.AddError(uuid, "product_uuid_taken", $"Produkt o identyfikatorze {uuid} już istnieje.");
                continue;
            }

            if (duplicated.Contains(uuid))
            {
                tracker.AddError(
                    uuid,
                    "product_uuid_taken",
                    $"Identyfikator {uuid} występuje w tym zadaniu więcej niż raz.");
            }
        }
    }
}
