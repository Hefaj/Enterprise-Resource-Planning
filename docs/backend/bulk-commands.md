# Operacje masowe

**Stan: ✅ działa.** Legenda znaczników — [`architecture.md`](./architecture.md#1-stan-wdrożenia).

Zadanie masowe jest **wierszem w bazie** razem ze swoimi elementami — przeżywa restart procesu
i wznawia się od pierwszego nieprzetworzonego elementu. Kolejka w pamięci procesu byłaby tu
pozorną prostotą: gubi pracę przy każdym wdrożeniu, a wyjątek z komendy nie ma gdzie wylądować.

---

## 1. Model danych

Schemat modułu **wykonującego** zadanie (Catalog, Sales, Identity — nie Notification, patrz sekcja 5):

```
job(uuid pk, command_type, command_json, queue_id, status,
    total_count, succeeded_count, failed_count,
    created_at, started_at, finished_at,
    user_id, client_id, correlation_id, ui_metadata, expire_on)

job_item(uuid pk, job_uuid fk, aggregate_uuid, ordinal, status,
         command_json, error_code, error_message, attempts, processed_at)
```

`job.uuid` **jest** `jobUuid`/`trackingID` z kontraktu HTTP — osobnej kolumny do śledzenia nie ma.

`job.status` ∈ `Pending | Running | Completed | CompletedWithErrors | Failed | Cancelled | Draft`.
Sukces częściowy ma **własny** status (`CompletedWithErrors`) — użytkownik musi odróżnić
„zrobione” od „zrobione, ale 1200 pozycji odpadło”, nie tylko `true`/`false`.

`Draft` jest stanem **wewnętrznym, przejściowym i niewidocznym na zewnątrz** — zadanie ma go
wyłącznie w trakcie zakładania, między wstawieniem nagłówka a przyjęciem (sekcja 2). Runner
podejmuje tylko `Pending`/`Running`, klient nie dostaje wtedy jeszcze `jobUuid`, a Notification
nie zna zadania, bo koperta `JobAccepted` jeszcze nie wyszła. Wartość dopisana na **końcu**
wyliczenia `JobStatus`, żeby nie ruszyć liczb, którymi zapisane są pozostałe statusy.

`job_item.command_json` bywa `null` — patrz tryby w sekcji 2.

Definicje: [`Job.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/Job.cs),
[`JobItem.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/JobItem.cs).

---

## 2. Endpoint — trzy tryby jednego kontraktu

[`BatchEndpointBase<TCommand, TFilter>`](../../backend/building-blocks/Erp.BuildingBlocks.Api/Contracts/BatchEndpointBase.cs)
przyjmuje `BatchCommand<TCommand, TFilter>` i sprowadza go do listy `JobTarget`:

| Tryb | Pole żądania | `JobItem.CommandJson` |
|---|---|---|
| Lista różnych komend | `Commands: TCommand[]` | własny payload każdego elementu (różne wartości per uuid) |
| Szablon + jawne cele | `TemplateCommand` + `TargetUuids` | `null` — element czyta `job.CommandJson` |
| Szablon + filtr | `TemplateCommand` + `TargetFilter` | `null` — jw. |

Tryby **nie wykluczają się nawzajem** — `Commands` i szablon mogą wystąpić razem, oba trafiają
do tej samej puli. Implementacja modułu dostarcza tylko `GetUuidsFromFilterAsync(TFilter, ct)`:

```csharp
public sealed class ProductSetPriceMultipleCommandEndpoint
    : BatchEndpointBase<ProductSetPriceCommand, SearchProductRequest>
{
    protected override async Task<IEnumerable<Guid>> GetUuidsFromFilterAsync(
        SearchProductRequest filter, CancellationToken ct)
        => await _queries.GetMatchingUuidsAsync(filter, ct);
}
```

Endpoint zakłada zadanie przez `IJobStore.CreateAsync` i natychmiast zwraca
`BatchResult { JobUuid }` — bez czekania na wykonanie.

### Zakładanie zadania idzie w trzech krokach

Zapis `job_item`-ów jest najliczniejszą rzeczą, jaką robi żądanie HTTP — i przez EF Core
kosztował **~3,6 s na 50 tys. celów**, zanim klient w ogóle zobaczył `jobUuid`. Binarne `COPY`
Postgresa robi to samo w ułamku tego czasu, ale nie da się go wykonać w tej samej transakcji
co koperta outboxu: Wolverine zapisuje kopertę dopiero razem z jej wypchnięciem
(`SaveChangesAndFlushMessagesAsync`), więc objęcie `COPY` wspólną transakcją przesunęłoby
wysyłkę **przed** commit — a nieudany commit zostawiłby Notification z zadaniem widmo.

Zamiast poświęcać atomowość, zakładanie zostało rozbite:

1. **Nagłówek** `job` w stanie `Draft` — zwykły `SaveChanges`, bez koperty i bez zdarzeń.
   (`Entry(job).State = Added`, nie `Jobs.Add(job)` — to drugie przeszłoby po grafie i wciągnęło
   do ChangeTrackera wszystkie elementy, czyli dokładnie te wiersze, które zaraz wstawi `COPY`.)
2. **Elementy** przez [`IJobItemBulkWriter`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/IJobItemBulkWriter.cs)
   — binarne `COPY` po tym samym połączeniu.
3. **Przyjęcie**: `job.MarkAccepted()` (`Draft` → `Pending`) razem z publikacją `JobAccepted`,
   w **jednej transakcji**, przez `IIntegrationEventPublisher`.

Gwarancja widoczna z zewnątrz zostaje **dokładnie ta sama**: zadanie staje się faktem w jednym
atomowym kroku, a klient dostaje `jobUuid` dopiero, gdy ten krok się powiedzie. Awaria przed
krokiem 3 zostawia szkic, którego nie widzi ani runner, ani klient, ani Notification — kosztem
jest osierocony wiersz, a nie zadanie wykonane po cichu w połowie.

Zmierzone (Postgres z `docker-compose`, wsad z 50% elementów niosących własny payload `jsonb`):

| celów | przed (EF `AddRange`) | po (`COPY`) |
|---|---|---|
| 1 000 | 532 ms | 25 ms |
| 10 000 | 1 082 ms | 151 ms |
| 50 000 | 3 600 ms | 625 ms |

`PostgresJobItemBulkWriter` bierze nazwy tabeli i kolumn **z modelu EF**, nie z literałów —
inaczej zmiana mapowania rozjechałaby się z nim po cichu. Kolumna, której writer nie zna
(bo ktoś dopisał pole do `JobItem`), przełącza go na ścieżkę EF: wolniej, ale bez ryzyka
wstawienia niekompletnego wiersza.

> **Co nadal jest materializowane.** Krok 1 wciąż buduje w pamięci komplet obiektów `JobItem`
> (`Job.Create`), a `GetMatchingUuidsAsync` całą listę uuidów — przy 50 tys. celów to ~33 MB
> sterty na żądanie. Strumieniowanie `SELECT uuid` → `COPY` bez pośredniej listy jest możliwe,
> ale wymagałoby oderwania pre-checku wsadowego od pełnego zbioru celów (reguły z
> [`batch-validation.md`](./batch-validation.md) z definicji widzą cały wsad naraz).
> Przy setkach tysięcy celów warte rewizji; przy dzisiejszej skali nieistotne.

---

## 3. Wykonanie — `BulkCommandRunner`

[`BulkCommandRunner<TContext>`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/BulkCommandRunner.cs)
to `BackgroundService` **czytający z bazy**, nie z kolejki w pamięci — restart w połowie zadania
wznawia pracę od pierwszego nieprzetworzonego `job_item`, zamiast gubić całość.

Pętla: znajdź najstarsze `Pending`/`Running` zadanie → weź do `ChunkSize` (domyślnie 500,
`BulkJobs:ChunkSize`) jego elementów ze statusem `Pending` → przetwórz w jednej transakcji.
Brak pracy → `Task.Delay(IdlePollingInterval)` (domyślnie 2 s) i pętla od nowa.

> **Wybór zadania zakłada jedną instancję serwisu.** Zapytanie nie bierze lease'u ani locka, więc
> dwa runnery wzięłyby to samo zadanie i te same elementy — kolizję wyłapałby dopiero `xmin` na
> zapisie, spychając chunk w opisaną niżej ścieżkę izolacji. Patrz
> [`architecture.md` §7](./architecture.md#7-założenia-jednoinstancyjne).

**Jeden chunk = jedna transakcja + jeden scope DI.** Każdy element wewnątrz chunka idzie przez
normalną szynę komend — ten sam `IBulkCommandExecutor`, który resolwuje handler zarejestrowany
dla `job.CommandType`, więc reguły domenowe są identyczne dla pojedynczej komendy i dla operacji
masowej.

### Skąd bierze się egzekutor

Nie z ręcznej rejestracji. `AddErpModule` skanuje zestawy modułu i dla **każdej komendy, która ma
handler** i spełnia ograniczenia `BulkCommandExecutor<TCommand>` (`IAggregateCommand`,
`ICommand<Guid>`, konstruktor bezparametrowy), zakłada wpis **kluczowany nazwą typu komendy**:

```csharp
services.AddKeyedScoped(typeof(IBulkCommandExecutor), command.Name,
    typeof(BulkCommandExecutor<>).MakeGenericType(command));
```

Klucz to dokładnie to, co `BatchEndpointBase` zapisuje w `job.command_type`
(`typeof(TCommand).Name`), więc runner sięga po egzekutora jednym
`GetKeyedService<IBulkCommandExecutor>(job.CommandType)`.

Klucz zamiast dawnego `GetServices<IBulkCommandExecutor>().FirstOrDefault(...)` jest tu warunkiem
opłacalności skanowania: tamten wariant konstruował **wszystkie** egzekutory — a przez nie
wszystkie handlery i repozytoria modułu — przy każdym chunku, żeby wybrać jeden. Przy kilkunastu
ręcznych wpisach było to niezauważalne; przy rejestracji automatycznej rosłoby razem z liczbą
komend modułu.

### Jeden chunk = jedno wczytanie

Przed pętlą runner woła `IBulkCommandExecutor.PreloadAsync` z uuidami całego chunka. Bez tego
handler każdego elementu pobierałby swój agregat osobnym `FindAsync` — a przy agregacie
z kolekcjami jeszcze **po jednym zapytaniu na kolekcję**, bo globalne `SplitQuery` rozbija każdy
`Include` na osobny SELECT. Dla produktu to sześć zapytań na element.

Ile agregatu wczytać, deklaruje **handler**, implementując
[`IBulkPreloadingHandler`](../../backend/building-blocks/Erp.BuildingBlocks.Application/Abstractions/IBulkPreloadingHandler.cs)
— bo to on wie, czego potrzebuje jego metoda domenowa. Handler bez tego interfejsu działa jak
dotąd (`PreloadAsync` jest wtedy no-opem), więc moduł, który wczytywania wsadowego nie chce,
nie zmienia niczego.

W Catalogu zakres wyraża `ProductLoadScope`: `SetName`/`SetPrice` dotykają wyłącznie kolumn
tabeli `product`, więc biorą `Root`; `SetClassification` podmienia komplet kategorii, więc
wymaga `Full`. Repozytorium serwuje agregat z pamięci kontekstu **tylko wtedy, gdy wczytanie
z góry objęło co najmniej żądany zakres** — przy zbyt wąskim schodzi do pełnego zapytania.
To nie jest ostrożność na wyrost: produkt wczytany jako sam korzeń, oddany metodzie
`SetClassification`, zobaczyłby puste `_categories` i dopisał nowe powiązania obok starych
zamiast je zastąpić.

Zmierzone na chunku 500 produktów (wczytanie + `SetName` + `SaveChanges`):

| | poleceń SQL | czas |
|---|---|---|
| przed | 3 001 | 1 668 ms |
| po (`Root`) | 2 | 84 ms |

W przeliczeniu na zadanie o 50 tys. produktów: ~300 tys. poleceń SQL i ~167 s wobec ~200 poleceń
i ~8 s. Przy `Full` (zmiana klasyfikacji) chunk kosztuje 6 zapytań zamiast 3 000.

Poboczny efekt, też istotny: przy zakresie `Root` w ChangeTrackerze siedzi 500 encji zamiast
8 576, więc `DetectChanges` — wołany przy każdym `SaveChanges` — spada ze 105 ms do 5 ms.

**Wczytanie z góry jest wyłącznie optymalizacją.** `ExecuteAsync` musi działać tak samo, gdy go
nie było: tak dzieje się przy pojedynczej komendzie z endpointu HTTP i przy elemencie
powtarzanym w trybie izolacji po awarii zapisu.

### Widoczność postępu a rozmiar chunka

`ChunkSize` jest **górną**, nie sztywną granicą. Zadanie mniejsze niż chunk dzieli się na
`BulkJobs:ProgressUpdateTarget` porcji (domyślnie 10, dolna granica `BulkJobs:MinChunkSize`),
czyli `chunk = clamp(ceil(total / target), MinChunkSize, ChunkSize)`.

Powód jest w outboxie: koperta `JobProgressed` zapisuje się w tej samej transakcji co praca,
więc postęp pokazuje się dopiero po **zatwierdzeniu** chunka. Przy jednym chunku na całe zadanie
wsad na pięć produktów pokazywałby „0/5" aż do końca — technicznie poprawnie i praktycznie
nieodróżnialnie od zawieszenia.

Duże zadania nie odczuwają zmiany: dla 50 tys. elementów `ceil(50000/10)` to 5 tys., czyli
powyżej `ChunkSize`, więc obowiązuje dotychczasowe 500. Płacą wyłącznie małe wsady — kilkoma
dodatkowymi commitami. `ProgressUpdateTarget ≤ 1` wyłącza mechanizm i przywraca stałe porcje.

### Częściowe niepowodzenie

`DomainException` jednego elementu **nie przerywa chunka** — element dostaje `Failed` + kod błędu,
pozostałe idą dalej. Opiera się to na regule z [`cqrs.md`](./cqrs.md#3-komendy): *metoda agregatu
waliduje przed zmianą stanu*, więc wyjątek domenowy oznacza, że nic się nie zmieniło i transakcja
zostaje czysta.

### Awaria zapisu (nie reguły biznesowej)

Konflikt optymistyczny (`xmin`) albo inny błąd bazy przy `SaveChanges` unieważnia **całą**
transakcję chunka — wtedy nie wiadomo, który element ją zepsuł. Runner powtarza wtedy ten sam
chunk **element po elemencie**, każdy we własnej transakcji: winowajca dostaje własny wpis
o błędzie (`concurrency_conflict` / `persistence_error`), reszta przechodzi. Kosztowna ścieżka,
wchodzi wyłącznie po faktycznej awarii zapisu — bez tego jeden konfliktujący wiersz zablokowałby
całe zadanie w nieskończonej pętli ponowień.

### Naruszenie unikalności to reguła biznesowa, nie awaria

Reguły oparte na unikalności (SKU, sygnatura duplikatu produktu) **muszą** być wymuszone
unikalnym indeksem, bo dwie równoległe komendy przeszłyby walidację aplikacyjną obie — patrz
[`batch-validation.md`](./batch-validation.md#11-czym-to-nie-jest-pre-check--gwarancja). Ich
naruszenie przychodzi jednak jako `DbUpdateException`, czyli tą samą ścieżką co awaria zapisu.

Bez tłumaczenia dawałoby to dwa problemy naraz: raport pokazywałby `1200 × persistence_error`
zamiast `1200 × product_duplicate` (komunikat, z którym użytkownik nic nie zrobi), a element
wracałby do puli ponowień — `JobItem.MarkFailed` odsyła go do `Pending`, dopóki nie wyczerpie
`MaxAttempts` — mimo że duplikat jest trwały i każda kolejna próba skończy się identycznie.

`RecordIsolatedFailureAsync` woła więc `IPersistenceExceptionTranslator` (opcjonalny —
`GetService`, nie `GetRequiredService`, więc moduł bez rejestracji zachowuje stare zachowanie).
Implementacja Postgresowa rozpoznaje `SQLSTATE 23505` i mapuje **nazwę indeksu** na kod
domenowy; mapę podaje moduł w swoim `Add<Moduł>Infrastructure`, bo nazwy indeksów są jego
szczegółem, a kody błędów jego językiem. Przetłumaczony błąd dostaje `maxAttempts: 1` —
to stan końcowy, nie błąd przejściowy.

Kody muszą się zgadzać z tymi, którymi posługuje się walidacja wsadowa. Inaczej ten sam problem
miałby dwie różne nazwy w zależności od tego, czy złapał go pre-check, czy baza.

### Kody błędów w raporcie

Po zamknięciu zadania `BuildErrorsSummaryAsync` grupuje `job_item.error_code` — `job.errors_summary`
to np. `"product_price_negative: 1200; category_name_empty: 40"`, nie tysiące osobnych komunikatów.

### Kontekst zleceniodawcy przeżywa poza żądaniem HTTP

Zadanie wykonuje się w tle długo po tym, jak żądanie, które je zleciło, dostało odpowiedź.
Runner odtwarza `UserId`/`ClientId`/`CorrelationId` zapisane w `job` przez `MutableExecutionContext`
przed każdym chunkiem — inaczej zdarzenia i powiadomienia SignalR nie miałyby adresata.

---

## 4. Anulowanie i retry

[`JobControlEndpoints`](../../backend/building-blocks/Erp.BuildingBlocks.Api/Contracts/JobControlEndpoints.cs)
(dodane w fazie 5 — **zmiana kontraktu**, odłożona świadomie z faz 1–4):

- **`POST job/cancel`** — ustawia `job.Status = Cancelled`. Nie cofa tego, co już się zapisało:
  `BulkCommandRunner` sprawdza status przed **każdym** chunkiem, więc elementy w trakcie
  przetwarzania kończą swój bieżący chunk, kolejne już nie startują.
- **`POST job/retry-failed`** — tworzy **nowe** zadanie z elementów `Failed` oryginału, nie
  modyfikuje go. Historia wykonania zostaje nietknięta; każdy ponawiany element niesie własny
  `JobItem.CommandJson`, jeśli go miał (tryb listy różnych komend), inaczej dziedziczy szablon
  oryginału — ponowienie odtwarza dokładnie to, co się nie udało, nie jego przybliżenie.

Oba są zaimplementowane w Catalogu
([`Catalog.Api/Jobs/JobControlEndpoints.cs`](../../backend/modules/Catalog/Catalog.Api/Jobs/JobControlEndpoints.cs))
i w Identity ([`Identity.Api/Jobs/JobControlEndpoints.cs`](../../backend/modules/Identity/Identity.Api/Jobs/JobControlEndpoints.cs));
Sales ma infrastrukturę zadań gotową (`IJobStore`, `BulkCommandRunner<SalesDbContext>` zarejestrowane),
ale nie wystawia jeszcze tych dwóch endpointów.

---

## 5. Replika w Notification

Job **wykonuje i jest jego właścicielem** serwis wykonujący — Catalog ma własne `catalog.job`/
`catalog.job_item`, potrzebne mu i tak do wznawiania i retry. Notification utrzymuje wyłącznie
**read-model replikę** w `notification.job`, karmioną zdarzeniami `JobAccepted`/`JobProgressed`/
`JobCompleted` (patrz [`JobReplicationHandlers.cs`](../../backend/modules/Notification/Notification.Infrastructure/Consumers/JobReplicationHandlers.cs)).
Dzięki temu `searchJob`/`getJob` na froncie zawsze odpytują Notification, a granica modułów nie
jest łamana joinem cross-schema.

`JobCompletedHandler` po zapisaniu repliki publikuje własny `AggregateChanged` na kanale `jobs`
(patrz [`realtime-signalr.md`](./realtime-signalr.md#4-kanał-jobs-a-notificationjob)) —
to jest osobny sygnał od automatycznego `AggregateChanged` na `notification.job`, który leci
z tego samego zapisu przez `AggregateChangeScanner`.

---

## 6. Zobacz też

- [Walidacja wsadowa](./batch-validation.md) — pre-check PRZED utworzeniem zadania, dla reguł
  zbiorczych (istnienie, duplikat), które kosztowałyby N zapytań przy walidacji per element
- [Zasięg zaznaczenia (frontend)](../frontend/selection-scope.md) — druga strona tego kontraktu:
  skąd UI bierze `targetUuids`/`targetFilter` i jak zachowuje się przy „Zaznacz wszystko"
- [CQRS — komendy i zapytania](./cqrs.md)
- [Zdarzenia domenowe i outbox](./events-outbox.md)
- [Synchronizacja w czasie rzeczywistym](./realtime-signalr.md)
- [Architektura backendu](./architecture.md)
