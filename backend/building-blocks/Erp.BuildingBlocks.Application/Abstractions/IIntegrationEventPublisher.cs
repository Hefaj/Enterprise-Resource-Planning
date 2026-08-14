namespace Erp.BuildingBlocks.Application.Abstractions;

/// <summary>
/// Publikuje zdarzenie integracyjne przez <b>transactional outbox</b>.
///
/// „Przez outbox” jest tu istotą, nie szczegółem: wywołanie tej metody nie wysyła niczego
/// na brokera od razu. Zdarzenie zostaje utrwalone w bazie w tej samej transakcji co zmiana
/// stanu, a dostarczeniem do RabbitMQ zajmuje się osobny proces. Dlatego:
///
/// <list type="bullet">
///   <item>padnięcie brokera nie blokuje zapisu — zdarzenia poczekają w bazie i dojdą później,</item>
///   <item>rollback transakcji zabiera ze sobą zdarzenia — nie da się rozgłosić zmiany, która się nie zapisała,</item>
///   <item>dostarczenie jest <i>at-least-once</i>, więc każdy konsument musi być idempotentny.</item>
/// </list>
///
/// Abstrakcja istnieje po to, żeby warstwa Application nie referencowała Wolverine'a;
/// implementacja żyje w <c>Erp.BuildingBlocks.Messaging</c>.
///
/// Parametr jest typu <c>object</c>, a nie generyczny, celowo: routing Wolverine'a rozstrzyga
/// po <c>message.GetType()</c>, nie po parametrze typowym, więc heterogeniczna lista zdarzeń
/// (<c>AggregateChanged</c> obok <c>JobProgressed</c>) trafi tam, gdzie trzeba, bez dynamicznej
/// dyspozycji po naszej stronie.
/// </summary>
public interface IIntegrationEventPublisher
{
    /// <summary>Kolejkuje zdarzenie do wysłania po zatwierdzeniu bieżącej transakcji.</summary>
    Task PublishAsync(object integrationEvent, CancellationToken cancellationToken = default);

    /// <summary>Kolejkuje wiele zdarzeń naraz.</summary>
    Task PublishAllAsync(IEnumerable<object> integrationEvents, CancellationToken cancellationToken = default);

    /// <summary>
    /// Zapisuje zmiany bieżącej jednostki pracy razem z zakolejkowanymi zdarzeniami w jednej
    /// transakcji, a po jej zatwierdzeniu wypycha je na brokera.
    ///
    /// Zapis i wypchnięcie są tu jedną operacją, bo tylko wtedy da się zagwarantować atomowość:
    /// gdyby <c>SaveChanges</c> i publikacja były osobnymi krokami sterowanymi z zewnątrz,
    /// wróciłoby dokładnie to okno niespójności, które outbox ma likwidować.
    /// </summary>
    Task SaveChangesAndFlushAsync(CancellationToken cancellationToken = default);
}
