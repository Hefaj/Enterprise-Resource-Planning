using Erp.BuildingBlocks.Domain;

namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Reaguje na zdarzenie domenowe <b>w tej samej transakcji</b> co komenda, która je wywołała —
/// bez outboxa, bez integration eventu, bez opuszczania procesu. To jest mechanizm dla reakcji
/// wewnątrz jednego modułu (np. zamknięcie zgłoszenia przelicza stan powiązanego zlecenia),
/// nie dla komunikacji między modułami — to robi <see cref="IDomainEventTranslator"/>.
///
/// <para>Handler dostaje przez konstruktor te same zależności scoped co handler komendy
/// (repozytoria, <c>DbContext</c> modułu) — mutacje, które w nim wykona, trafiają do tego
/// samego zapisu, bo <see cref="IUnitOfWork.SaveChangesAsync"/> wywołuje dispatch PRZED
/// końcowym <c>DetectChanges</c>/zapisem.</para>
///
/// <para>Świadomie bez rekursji: zdarzenia domenowe zebrane od agregatów zmienionych przez
/// handler nie są dalej dispatchowane w tym samym przebiegu. Łańcuch reakcji reagujących na
/// reakcje byłby trudny do prześledzenia i grozi pętlą — jeśli taki scenariusz się pojawi,
/// to sygnał, żeby przeprojektować, a nie dokładać rekursję.</para>
/// </summary>
/// <typeparam name="TEvent">Konkretny typ zdarzenia domenowego.</typeparam>
public interface IDomainEventListener<in TEvent>
    where TEvent : IDomainEvent
{
    /// <summary>Obsługuje zdarzenie. Wyjątek przerywa cały zapis komendy, która je wywołała.</summary>
    Task HandleAsync(TEvent domainEvent, CancellationToken cancellationToken);
}
