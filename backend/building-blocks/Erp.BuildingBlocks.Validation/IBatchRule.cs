namespace Erp.BuildingBlocks.Validation;

/// <summary>
/// Pojedyncza, testowalna reguła walidacji wsadowej.
///
/// Zamiast weryfikować agregaty pojedynczo, reguła przyjmuje CAŁĄ listę lekkich obiektów
/// (DTO, identyfikatory) i w razie potrzeby wykonuje JEDNO zbiorcze zapytanie do bazy dla
/// całej listy, po czym oznacza błędne rekordy w <see cref="ValidationTracker"/>. To jest
/// powód, dla którego ten mechanizm istnieje osobno od walidacji w agregacie
/// (<c>Product.SetPrice</c> itp.) — tamta działa per encja, po jednym zapytaniu na element,
/// co przy tysiącach celów operacji masowej oznacza tysiące zapytań.
/// </summary>
/// <typeparam name="T">Typ elementu wsadu — lekkie DTO albo sam identyfikator agregatu.</typeparam>
public interface IBatchRule<T>
{
    /// <summary>
    /// Waliduje <paramref name="items"/> i dopisuje naruszenia do <paramref name="tracker"/>.
    /// Reguła NIE usuwa elementów z listy ani nie rzuca wyjątków dla naruszeń biznesowych —
    /// to rola <see cref="ValidationTracker"/>; wyjątek oznaczałby przerwanie całego wsadu.
    /// </summary>
    /// <param name="items">Elementy do zweryfikowania — już przefiltrowane przez poprzednie
    /// reguły łańcucha, jeśli reguła jest jego częścią.</param>
    /// <param name="idSelector">Wyciąga identyfikator agregatu z elementu wsadu — ten sam
    /// selektor, którym posługuje się wywołujący (np. <see cref="ValidationChain{T}"/>),
    /// żeby błędy trafiały pod ten sam klucz niezależnie od reguły.</param>
    /// <param name="tracker">Współdzielony zbiornik błędów.</param>
    /// <param name="cancellationToken">Token anulowania.</param>
    Task ExecuteAsync(
        IReadOnlyList<T> items,
        Func<T, Guid> idSelector,
        ValidationTracker tracker,
        CancellationToken cancellationToken);
}
