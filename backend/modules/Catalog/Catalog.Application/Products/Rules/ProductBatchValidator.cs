using Erp.BuildingBlocks.Validation;

namespace Catalog.Application.Products;

/// <summary>
/// Wie, JAKIE reguły wsadowe obowiązują dla której operacji masowej na produktach.
///
/// <para><b>Dlaczego to jest w Application, a nie w endpoincie.</b> „Które reguły biznesowe
/// stosujemy przy masowej zmianie klasyfikacji” to decyzja przypadku użycia, a nie transportu.
/// Zostawiona w konstruktorze endpointu znika w momencie, w którym tę samą komendę zleci coś
/// innego niż HTTP (konsumer zdarzeń, harmonogram, inny endpoint), a przy czwartej regule
/// zamienia endpoint w miejsce orkiestracji biznesowej. Przy okazji: test tego pre-checku
/// nie wymaga podnoszenia endpointu FastEndpoints przez <c>Factory.Create</c>.</para>
///
/// <para>Reguły są od siebie niezależne (istnienie agregatu vs duplikat klasyfikacji), więc
/// wołamy je po kolei na tej samej pełnej liście, bez <see cref="ValidationChain{T}"/> —
/// zależy nam na zebraniu WSZYSTKICH naruszeń elementu naraz. Łańcuch ma sens tam, gdzie
/// kolejny krok zakłada, że poprzedni przeszedł.</para>
/// </summary>
public sealed class ProductBatchValidator : IBatchValidator
{
    private readonly ProductMustExistRule _mustExist;
    private readonly ProductDuplicateRule _duplicate;
    private readonly ProductMultimediaMustExistRule _multimediaMustExist;

    public ProductBatchValidator(
        ProductMustExistRule mustExist,
        ProductDuplicateRule duplicate,
        ProductMultimediaMustExistRule multimediaMustExist)
    {
        _mustExist = mustExist;
        _duplicate = duplicate;
        _multimediaMustExist = multimediaMustExist;
    }

    /// <summary>Pre-check masowej zmiany nazw. Nazwa nie zależy od stanu bazy, więc jedyną
    /// regułą wsadową jest istnienie celu; poprawność samej nazwy waliduje agregat.</summary>
    public Task<ValidationTracker> ValidateSetNameAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
        => ValidateExistenceAsync(aggregateUuids, cancellationToken);

    /// <summary>Pre-check masowej zmiany cen. Jak wyżej — cena jest regułą agregatu.</summary>
    public Task<ValidationTracker> ValidateSetPriceAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
        => ValidateExistenceAsync(aggregateUuids, cancellationToken);

    /// <summary>
    /// Pre-check masowej zmiany klasyfikacji: cel musi istnieć i nie może stać się duplikatem.
    /// </summary>
    public async Task<ValidationTracker> ValidateSetClassificationAsync(
        IReadOnlyList<ProductClassificationTarget> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        var uuids = targets.Select(t => t.Uuid).Distinct().ToList();
        await _mustExist.ExecuteAsync(uuids, uuid => uuid, tracker, cancellationToken).ConfigureAwait(false);

        await _duplicate.ExecuteAsync(targets, t => t.Uuid, tracker, cancellationToken).ConfigureAwait(false);

        return tracker;
    }

    /// <summary>
    /// Pre-check masowego dopięcia multimediów: musi istnieć i produkt, i każdy z dopinanych
    /// plików. Obie reguły lecą na tej samej liście celów, bo są niezależne — chcemy zobaczyć
    /// komplet naruszeń celu naraz, a nie pierwsze z nich.
    /// </summary>
    public async Task<ValidationTracker> ValidateAddMultimediaAsync(
        IReadOnlyList<ProductMultimediaTarget> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        var uuids = targets.Select(t => t.Uuid).Distinct().ToList();
        await _mustExist.ExecuteAsync(uuids, uuid => uuid, tracker, cancellationToken).ConfigureAwait(false);

        await _multimediaMustExist.ExecuteAsync(targets, t => t.Uuid, tracker, cancellationToken)
            .ConfigureAwait(false);

        return tracker;
    }

    /// <summary>
    /// Pre-check masowego odpięcia multimediów: sprawdzamy wyłącznie istnienie produktu.
    ///
    /// <para>Odpinany zasób celowo NIE musi istnieć. Przy dopinaniu nieistniejący uuid jest
    /// błędem, bo powstałaby referencja donikąd; przy odpinaniu jest opisem stanu, który już
    /// obowiązuje — odrzucanie takiego żądania wywracałoby paczkę przez odpięcie zrobione
    /// wcześniej ręcznie.</para>
    /// </summary>
    public Task<ValidationTracker> ValidateRemoveMultimediaAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
        => ValidateExistenceAsync(aggregateUuids, cancellationToken);

    /// <summary>
    /// Pre-check masowej podmiany galerii: cel musi istnieć, a każdy zasób z listy docelowej
    /// musi być w katalogu — bo po podmianie ma na niego wskazywać referencja.
    ///
    /// <para>Różnica wobec dopinania jest jedna, ale istotna: <b>pusta lista jest poprawna</b>
    /// i znaczy „wyczyść galerię". Dlatego do reguły istnienia zasobów idą wyłącznie cele
    /// z niepustą listą — inaczej wyczyszczenie odpadłoby z błędem <c>multimedia_empty</c>,
    /// czyli dokładnie na tym, o co użytkownik prosił.</para>
    /// </summary>
    public async Task<ValidationTracker> ValidateSetMultimediaAsync(
        IReadOnlyList<ProductMultimediaTarget> targets,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(targets);

        var tracker = new ValidationTracker();

        var uuids = targets.Select(t => t.Uuid).Distinct().ToList();
        await _mustExist.ExecuteAsync(uuids, uuid => uuid, tracker, cancellationToken).ConfigureAwait(false);

        var withAssets = targets.Where(t => t.MultimediaUuids.Count > 0).ToList();
        if (withAssets.Count > 0)
        {
            await _multimediaMustExist.ExecuteAsync(withAssets, t => t.Uuid, tracker, cancellationToken)
                .ConfigureAwait(false);
        }

        return tracker;
    }

    private async Task<ValidationTracker> ValidateExistenceAsync(
        IReadOnlyList<Guid> aggregateUuids,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(aggregateUuids);

        var tracker = new ValidationTracker();

        // Deduplikacja po agregacie: reguła istnienia pyta o byt celu, więc dwa razy ten sam
        // uuid to jedno pytanie. Błąd i tak trafi do wszystkich elementów tego agregatu,
        // bo `preValidatedFailures` jest słownikiem po uuid (patrz Job.Create).
        var uuids = aggregateUuids.Distinct().ToList();

        await _mustExist.ExecuteAsync(uuids, uuid => uuid, tracker, cancellationToken).ConfigureAwait(false);

        return tracker;
    }
}
