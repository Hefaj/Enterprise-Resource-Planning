---
id: architecture.integration-events
title: Zdarzenia domenowe, outbox i integracja
summary: Zdarzenia domenowe i integracyjne, transactional outbox oraz konsumenci RabbitMQ.
kind: architecture
scope: backend
audience:
  - backend
  - agent
triggers:
  - zdarzenie domenowe lub integracyjne
  - outbox i konsument RabbitMQ
related: []
---

# Zdarzenia domenowe, outbox i integracja

**Stan: ✅ działa.** `AddErpMessaging<TContext>()` jest wołane w `Program.cs` Catalogu, Sales
i Notification. Notification dodatkowo **konsumuje** — `AggregateChangedRelayHandler` przekazuje
`AggregateChanged` do `RealtimeBroadcaster` ([`realtime-signalr.md`](realtime.md)),
a `JobAcceptedHandler`/`JobProgressedHandler`/`JobCompletedHandler` utrzymują replikę
`notification.job` — patrz [`bulk-commands.md`](../guides/backend/bulk-commands.md#5-replika-w-notification).

---

## 1. Dwa rodzaje zdarzeń — i dlaczego to rozróżnienie jest istotne

| | Zdarzenie domenowe | Zdarzenie integracyjne |
|---|---|---|
| Gdzie żyje | `<Moduł>.Domain` | `Erp.BuildingBlocks.Contracts` |
| Zasięg | Wewnątrz procesu, szczegół implementacyjny modułu | Kontrakt publiczny, wersjonowany |
| Kto widzi | Tylko ten moduł | Wszystkie mikroserwisy |
| Przykład | `ProductPriceChanged` | `AggregateChanged`, `JobCompleted` |

Gdyby moduły subskrybowały bezpośrednio zdarzenia domenowe sąsiada, każda zmiana kształtu agregatu
byłaby zmianą łamiącą u wszystkich konsumentów. Tłumaczeniem jednych na drugie zajmuje się
`IDomainEventTranslator` — i to on jest granicą modułu.

Zwrócenie pustej sekwencji przez translator jest normalne i oznacza „to zdarzenie nie opuszcza modułu".

---

## 2. Powiadomienie o zmianie NIE idzie przez zdarzenia domenowe

To najważniejsza decyzja w tym dokumencie.

Samo „ten agregat się zmienił" **nie jest zdarzeniem domenowym i nie wymaga ani jednej linijki
w handlerze komendy**. Wyprowadza je automatycznie
[`AggregateChangeScanner`](../../backend/building-blocks/Erp.BuildingBlocks.Persistence/AggregateChangeScanner.cs)
z ChangeTrackera EF Core.

Powód: gdyby każda komenda musiała pamiętać o wypchnięciu powiadomienia, prędzej czy później ktoś
by o tym zapomniał przy nowej komendzie. Objawiłoby się to jako **cicho nieodświeżający się
interfejs u użytkownika** — bez wyjątku, bez logu, bez testu, który by to złapał. Najgorszy
możliwy rodzaj błędu.

Przy podejściu z ChangeTrackera zapis agregatu *z definicji* generuje powiadomienie: nie da się go
pominąć, nie pomijając zapisu.

Zdarzenia domenowe zostają dla **reakcji biznesowych** („produkt wycofany → Sales zamyka oferty"),
a nie dla faktu „coś się zmieniło".

---

## 3. Skaner ChangeTrackera

Mapę „typ agregatu → sygnatura kanału" rejestruje moduł przy starcie:

```csharp
new AggregateSignatureMap()
    .Register<Product>(AggregateSignatures.CatalogProduct)
    .Register<Category>(AggregateSignatures.CatalogCategory)
    // …
```

Rejestracja odrzuca sygnatury spoza `AggregateSignatures.All` **przy starcie** — literówka
oznaczałaby rozgłaszanie na kanał, którego nikt nie słucha, a to nie objawia się niczym w czasie działania.

Agregaty **spoza** mapy (np. `Job`) świadomie nie trafiają do klientów bezpośrednio.

### Przypadek brzegowy, dla którego to wszystko istnieje

Gdy komenda modyfikuje wyłącznie kolekcję owned (np. gwarancje produktu), EF oznacza jako
`Modified` encję-dziecko, a **korzeń zostaje `Unchanged`**. Naiwny skan „weź wpisy będące
`AggregateRoot`" nie zwróciłby wtedy nic i produkt cicho nie odświeżyłby się u klientów.

Dlatego dla każdego zmienionego wpisu skaner wchodzi po relacji własności do korzenia
(`entry.Metadata.FindOwnership()`), czytając wartość klucza obcego — a nie szukając wpisu
właściciela w ChangeTrackerze, bo ten wcale nie musi być załadowany.

Usunięcie dziecka jest raportowane jako `Upserted` korzenia, nie jako `Deleted` — korzeń nadal
istnieje, tylko w zmienionej postaci.

> **Ograniczenie.** Zagnieżdżone typy owned (owned wewnątrz owned) **nie są obsługiwane**:
> klucz obcy dziecka wskazuje wtedy pośrednika, nie korzeń. Model, w którym to wystąpi, musi albo
> spłaszczyć zagnieżdżenie, albo wypublikować `AggregateChanged` jawnie.

Zdarzenia są grupowane po parze (sygnatura, rodzaj zmiany): chunk 500 produktów daje **jedno**
zdarzenie z 500 identyfikatorami, nie 500 zdarzeń.

---

## 4. Transactional outbox

```
handler → agregat          (zmiana stanu, zdarzenia domenowe w buforze)
        ↓
IUnitOfWork.SaveChangesAsync()
        ├─ DetectChanges
        ├─ skan ChangeTrackera → AggregateChanged
        ├─ zdarzenia domenowe → translatory → zdarzenia integracyjne
        ├─ publisher.PublishAllAsync()      ← zapis kopert przez TEN SAM DbContext
        ├─ SaveChangesAndFlushAsync()       ← JEDNA transakcja: dane + koperty
        └─ wyczyszczenie buforów w agregatach
```

Kolejność nie jest dowolna:

- `DetectChanges` **przed** skanem — inaczej zmiany na encjach POCO nie są jeszcze widoczne.
- Zebranie zdarzeń domenowych **przed** zapisem — po nim usunięte agregaty są odpięte od kontekstu.
- Wyczyszczenie buforów **po** zapisie — żeby ponowny zapis w tym samym scope nie wysłał ich drugi raz.

`ErpUnitOfWork` deleguje zapis do `IIntegrationEventPublisher.SaveChangesAndFlushAsync()`, a nie
woła `DbContext.SaveChanges()` wprost. Wygląda to na inwersję, ale jest jedynym sposobem, by wiersze
outboxu trafiły do tej samej transakcji co dane — o co w całym wzorcu chodzi.

Co to daje:

- **Padnięcie brokera nie blokuje zapisu** — zdarzenia poczekają w bazie i dojdą po jego powrocie.
- **Rollback zabiera zdarzenia ze sobą** — nie da się rozgłosić zmiany, która się nie zapisała.
- **Dostarczenie jest at-least-once** → **każdy consumer musi być idempotentny**.

Koperty trzymają tabele Wolverine'a w schemacie `wolverine`, osobnym od schematów modułów —
to infrastruktura, nie model domenowy, i nie ma wpadać w migracje modułu.

`SaveChangesAsync` **nie zwraca liczby wierszy**. Wolverine jej nie raportuje, a zmyślenie
(np. zwracanie zera) byłoby gorsze niż brak — ktoś prędzej czy później oparłby na tym decyzję.
Liczniki operacji masowych są w `job`/`job_item`, gdzie są liczone rzetelnie.

---

## 5. Kontrakty integracyjne

`Erp.BuildingBlocks.Contracts` to **jedyny projekt współdzielony między serwisami na poziomie
kontraktu**. Test architektoniczny pilnuje, że zależy wyłącznie od BCL — dociągnięcie tu czegokolwiek
zmusiłoby wszystkich konsumentów do tej samej zależności.

Wersjonowanie: **tylko dodawanie pól**.

```csharp
public sealed record AggregateChanged(
    string Signature,                 // 'catalog.product'
    IReadOnlyList<Guid> Uuids,
    ChangeType Change,                // Upserted | Deleted
    Guid CorrelationId,
    DateTimeOffset OccurredAt);
```

Zdarzenie niesie **tylko identyfikatory, nie stan**. Klient dostaje sygnał „to jest nieaktualne"
i sam pobiera świeże dane zwykłym `getX`. Dzięki temu kontrakt zdarzenia nie musi nadążać za
kształtem DTO, a autoryzacja odczytu zostaje na endpoincie HTTP — event nie może wyciec pól,
których odbiorca nie ma prawa zobaczyć.

`ChangeType.Deleted` jest niezbędne: samo „odśwież po uuid" nie odróżnia usunięcia od błędu
pobrania, więc bez niego usunięte wiersze zostawałyby w cache klienta.

### Sygnatury

`AggregateSignatures` musi zgadzać się **co do znaku** z `signalrSignature` w orkiestratorach
(`frontend/libs/modules/*/data-access/.../\*.orchestrator.ts`):

`catalog.product`, `catalog.category`, `catalog.model`, `catalog.multimedia`, `catalog.warranty`,
`notification.job` oraz osobny kanał `jobs`.

> `jobs` celowo łamie konwencję `{moduł}.{agregat}`. Na `notification.job` lecą **uuid agregatów Job**
> (orkiestrator odświeża cache przez `getJob`), a na `jobs` — **trackingID** zadań, których słucha
> `JobService`, żeby oznaczyć zadanie jako zakończone bez odpytywania API.

---

## 6. Konfiguracja Wolverine

```csharp
builder.AddErpMessaging<CatalogDbContext>(typeof(SomeConsumer).Assembly);
```

Robi: transport RabbitMQ, trwałość outbox/inbox na Postgresie, integrację transakcji z EF Core,
oraz rejestruje `IIntegrationEventPublisher` i `IUnitOfWork`.

Routing jest po **przestrzeni nazw**, nie po pojedynczych typach:

```csharp
wolverine.Publish(x =>
{
    x.MessagesFromAssemblyContaining<AggregateChanged>();
    x.ToRabbitExchange("erp.events");
});
```

Nowy kontrakt dodany do `Contracts` jest publikowalny od razu — bez klasy błędu „dodałem event,
a on nigdzie nie leci".

Konfiguracja (`Messaging` w appsettings) jest walidowana przy starcie i rzuca twardo. Brak
konfiguracji ma objawić się przy uruchomieniu, a nie przy pierwszej komendzie w godzinach szczytu.

`AutoProvision` (zakładanie kolejek i wymian) jest wygodne lokalnie; na produkcji topologię
zakłada kontrolowany deployment, żeby aplikacja nie potrzebowała uprawnień do jej zmiany.

---

## 7. Jak zweryfikować atomowość ręcznie

```bash
podman compose -f backend/docker-compose.yml stop rabbitmq
# albo: docker compose -f backend/docker-compose.yml stop rabbitmq
```

Wykonaj komendę przez API modułu — zapis w Postgresie przechodzi normalnie, zdarzenie zostaje
w tabeli outboksu Wolverine'a (schemat `wolverine`). Po `podman compose ... start rabbitmq`
zalega dostarcza się bez interwencji. Jeśli zamiast tego zapis też się nie uda, atomowość jest
złamana — sygnał, że ktoś ominął `IUnitOfWork` i woła `DbContext.SaveChanges()` wprost.

---

## 8. Zobacz też

- [Operacje masowe](../guides/backend/bulk-commands.md)
- [Synchronizacja w czasie rzeczywistym](realtime.md) — konsument `AggregateChanged`
- [CQRS](../guides/backend/cqrs.md)
