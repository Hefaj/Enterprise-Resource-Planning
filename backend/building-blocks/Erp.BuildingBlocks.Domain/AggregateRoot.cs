namespace Erp.BuildingBlocks.Domain;

/// <summary>
/// Korzeń agregatu — jedyny byt, który wolno załadować i zapisać przez repozytorium,
/// i jedyna granica spójności transakcyjnej. Wszystko wewnątrz agregatu zmienia się razem
/// w jednej transakcji; między agregatami spójność jest wyłącznie ewentualna (przez zdarzenia).
///
/// Reguła, na której stoi cały model zapisu: <b>stan zmienia wyłącznie metoda agregatu</b>.
/// Handler komendy ładuje agregat, woła metodę domenową i zapisuje — nigdy nie ustawia
/// właściwości z zewnątrz. Dlatego settery są <c>private</c>/<c>protected</c>, a każda zmiana
/// przechodzi przez walidację reguły biznesowej i emituje zdarzenie przez <see cref="Raise"/>.
/// </summary>
public abstract class AggregateRoot : Entity
{
    private readonly List<IDomainEvent> _domainEvents = [];

    protected AggregateRoot(Guid uuid) : base(uuid)
    {
    }

    /// <summary>Konstruktor dla EF Core (materializacja z bazy) — nie używać w kodzie domenowym.</summary>
    protected AggregateRoot()
    {
    }

    /// <summary>
    /// Zdarzenia zebrane od ostatniego zapisu. Zdejmuje je interceptor EF tuż przed
    /// <c>SaveChanges</c> i wstawia do outboxu w tej samej transakcji — patrz
    /// <c>DomainEventCollectorInterceptor</c> w <c>Erp.BuildingBlocks.Persistence</c>.
    /// </summary>
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    /// <summary>Rejestruje fakt, który zaszedł w agregacie. Wywoływane wyłącznie z metod domenowych,
    /// PO tym jak reguła została sprawdzona i stan faktycznie się zmienił.</summary>
    protected void Raise(IDomainEvent domainEvent)
    {
        ArgumentNullException.ThrowIfNull(domainEvent);
        _domainEvents.Add(domainEvent);
    }

    /// <summary>Czyści bufor zdarzeń. Woła to wyłącznie infrastruktura po przeniesieniu
    /// zdarzeń do outboxu — nigdy kod domenowy ani aplikacyjny.</summary>
    public void ClearDomainEvents() => _domainEvents.Clear();
}
