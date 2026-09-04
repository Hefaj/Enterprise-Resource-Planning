namespace Catalog.Application.Multimedia;

/// <summary>
/// Kaskada dla zasobów <c>Owned</c>: usuwa plik razem z ostatnią referencją do niego, w tej samej
/// transakcji, w której ta referencja znika (<c>docs/guides/backend/media-storage.md</c> §4c).
///
/// <para><b>Dlaczego to nie jest worker kasujący po zerowym liczniku.</b> Zamiatanie w tle usuwa
/// dane użytkownika na podstawie heurystyki, w oknie między dwoma jego kliknięciami — odpięcie
/// zdjęcia od jednego produktu, żeby przepiąć je do innego, wyglądałoby wtedy jak śmieć.
/// Tutaj decyzja jest deterministyczna: kasujemy wyłącznie to, co właściciel zadeklarował jako
/// swoje (<c>Ownership.Owned</c>), i wyłącznie w momencie, w którym tracimy do tego ostatnią
/// referencję.</para>
///
/// <para><b>Dlaczego osobny byt, a nie kod w handlerze.</b> Referencję odpina dziś
/// <c>ProductRemoveMultimediaCommand</c> i <c>ProductSetMultimediaCommand</c>, jutro dołoży się
/// usunięcie produktu i faktury w DMS. Reguła „co znika razem z ostatnią referencją" jest wspólna
/// dla wszystkich tych ścieżek i nie ma powodu, żeby każda pamiętała o niej po swojemu.</para>
/// </summary>
public interface IMultimediaCascade
{
    /// <summary>
    /// Domyka odpięcie zasobów od jednego agregatu.
    /// </summary>
    /// <param name="productUuid">Produkt, który właśnie stracił te powiązania.</param>
    /// <param name="detachedMultimediaUuids">Zasoby faktycznie odpięte przez agregat.</param>
    Task ApplyAsync(
        Guid productUuid,
        IReadOnlyCollection<Guid> detachedMultimediaUuids,
        CancellationToken cancellationToken);
}
