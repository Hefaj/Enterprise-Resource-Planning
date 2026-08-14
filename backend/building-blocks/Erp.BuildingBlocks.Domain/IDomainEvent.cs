namespace Erp.BuildingBlocks.Domain;

/// <summary>
/// Zdarzenie domenowe — fakt, który zaszedł wewnątrz agregatu (<c>ProductNameChanged</c>,
/// <c>CategoryMoved</c>). Jest <b>szczegółem wewnętrznym modułu</b> i nigdy nie opuszcza procesu:
/// na granicy serwisu tłumaczy się je na integration event z
/// <c>Erp.BuildingBlocks.Contracts</c>, który jest wersjonowanym kontraktem publicznym.
///
/// Rozdział jest celowy — gdyby moduły subskrybowały bezpośrednio zdarzenia domenowe sąsiada,
/// każda zmiana kształtu agregatu byłaby zmianą łamiącą u wszystkich konsumentów.
///
/// Zdarzenia zbiera <see cref="AggregateRoot"/>; zdejmuje je interceptor EF w tej samej
/// transakcji co zapis (outbox), więc „stan zapisany” i „zdarzenie wysłane” są atomowe.
/// </summary>
public interface IDomainEvent
{
    /// <summary>Moment wystąpienia faktu (UTC).</summary>
    DateTimeOffset OccurredAt { get; }
}
