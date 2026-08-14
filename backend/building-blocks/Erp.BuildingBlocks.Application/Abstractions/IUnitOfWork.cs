namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Granica transakcji. Handler komendy zmienia agregat i woła <see cref="SaveChangesAsync"/>;
/// nie wie, że pod spodem jest EF Core ani że przy okazji zapisu do outboxu trafiają
/// zdarzenia integracyjne.
///
/// Kluczowa gwarancja: zapis stanu i utrwalenie zdarzeń dzieją się w JEDNEJ transakcji.
/// Bez tego istnieje okno, w którym baza już zna zmianę, a zdarzenie nigdy nie poleci
/// (albo odwrotnie) — i cache po stronie klientów rozjeżdża się na trwałe, bez żadnego sygnału.
/// </summary>
public interface IUnitOfWork
{
    /// <summary>
    /// Zatwierdza wszystkie zmiany bieżącego scope'u wraz ze zdarzeniami w outboxie.
    ///
    /// Celowo nie zwraca liczby zmienionych wierszy: zapis idzie przez outbox Wolverine'a,
    /// który tej liczby nie raportuje, a zmyślenie jej (np. zwracanie zera) byłoby gorsze
    /// niż jej brak — ktoś prędzej czy później oparłby na niej decyzję.
    /// Kod, który potrzebuje wiedzieć, ile rekordów zmieniła operacja masowa, ma tę informację
    /// w licznikach <c>job</c>/<c>job_item</c>, gdzie jest liczona rzetelnie.
    /// </summary>
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
