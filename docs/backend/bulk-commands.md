# Operacje masowe

**Stan: ✅ działa.** Legenda znaczników — [`architecture.md`](./architecture.md#1-stan-wdrożenia).
Zweryfikowane na 1500 produktach Catalogu (sprawdzian fazy 3): zadanie kończy się w sekundach,
nie w ~75 minutach jak poprzednia implementacja (`Task.Delay(3000)` per element, sekwencyjnie).

---

## 1. Co się zmieniło względem pierwszej wersji

Stara `BatchEndpointBase` wrzucała domknięcie do `Channel<T>` w pamięci procesu i zwracała
wygenerowany w locie `jobUuid`, za którym nie stało nic:

- restart procesu gubił całą kolejkę w toku;
- wyjątki lądowały w `Console.WriteLine`, nigdy w bazie;
- komendy wykonywały się poza scope'em DI — `Cannot resolve scoped service from root provider`,
  cicho, bo nikt tego wyjątku nie czytał;
- frontend rejestrował zadanie, o którym backend nigdy się nie dowiedział, i czekał na
  zakończenie, które nie nadchodziło.

Dziś zadanie jest wierszem w bazie razem ze swoimi elementami. **Kontrakt HTTP jest identyczny**
— te same trzy tryby wskazywania celów, ten sam `BatchResult { JobUuid }`. To był twardy warunek
brzegowy: klienty NSwag i orkiestratory frontendowe nie wymagały żadnej zmiany.

---

## 2. Model danych

Schemat modułu **wykonującego** zadanie (Catalog, Sales — nie Notification, patrz sekcja 4):

```
job(uuid pk, command_type, command_json, queue_id, status,
    total_count, succeeded_count, failed_count,
    created_at, started_at, finished_at,
    user_id, client_id, correlation_id, ui_metadata, expire_on)

job_item(uuid pk, job_uuid fk, aggregate_uuid, ordinal, status,
         command_json, error_code, error_message, attempts, processed_at)
```

`job.uuid` **jest** `jobUuid`/`trackingID` z kontraktu HTTP — osobnej kolumny do śledzenia nie ma.

`job.status` ∈ `Pending | Running | Completed | CompletedWithErrors | Failed | Cancelled`.
Sukces częściowy ma **własny** status (`CompletedWithErrors`) — użytkownik musi odróżnić
„zrobione” od „zrobione, ale 1200 pozycji odpadło”, nie tylko `true`/`false`.

`job_item.command_json` bywa `null` — patrz tryby w sekcji 3.

Definicje: [`Job.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/Job.cs),
[`JobItem.cs`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/JobItem.cs).

---

## 3. Endpoint — trzy tryby jednego kontraktu

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

Endpoint zapisuje `job` + `job_item`-y i publikuje `JobAccepted` w **jednej transakcji**
(przez `IJobStore.CreateAsync` → `IIntegrationEventPublisher`), po czym natychmiast zwraca
`BatchResult { JobUuid }` — bez czekania na wykonanie.

> **Znane uproszczenie względem pierwotnego projektu.** Tryb szablon+filtr miał strumieniować
> `SELECT uuid` i wstawiać `job_item`-y porcjami, żeby nie materializować całego zbioru w pamięci
> przy dziesiątkach tysięcy trafień. Dzisiejsza implementacja (`GetMatchingUuidsAsync` →
> `List<Guid>` → `Job.Create` buduje całą kolekcję `JobItem` w pamięci przed jednym `Add`)
> materializuje wszystko. Przy setkach tysięcy celów to warte rewizji; przy dzisiejszej skali
> (≤ dziesiątki tysięcy) nieistotne.

---

## 4. Wykonanie — `BulkCommandRunner`

[`BulkCommandRunner<TContext>`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/BulkCommandRunner.cs)
to `BackgroundService` **czytający z bazy**, nie z kolejki w pamięci — restart w połowie zadania
wznawia pracę od pierwszego nieprzetworzonego `job_item`, zamiast gubić całość.

Pętla: znajdź najstarsze `Pending`/`Running` zadanie → weź do `ChunkSize` (domyślnie 500,
`BulkJobs:ChunkSize`) jego elementów ze statusem `Pending` → przetwórz w jednej transakcji.
Brak pracy → `Task.Delay(IdlePollingInterval)` (domyślnie 2 s) i pętla od nowa.

**Jeden chunk = jedna transakcja + jeden scope DI.** Każdy element wewnątrz chunka idzie przez
normalną szynę komend — ten sam `IBulkCommandExecutor`, który resolwuje handler zarejestrowany
dla `job.CommandType`, więc reguły domenowe są identyczne dla pojedynczej komendy i dla operacji
masowej.

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

## 5. Anulowanie i retry

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
([`Catalog.Api/Jobs/JobControlEndpoints.cs`](../../backend/modules/Catalog/Catalog.Api/Jobs/JobControlEndpoints.cs)); Sales ma
infrastrukturę zadań gotową (`IJobStore`, `BulkCommandRunner<SalesDbContext>` zarejestrowane),
ale nie wystawia jeszcze tych dwóch endpointów.

---

## 6. Replika w Notification

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

## 7. Zobacz też

- [Walidacja wsadowa](./batch-validation.md) — pre-check PRZED utworzeniem zadania, dla reguł
  zbiorczych (istnienie, duplikat), które kosztowałyby N zapytań przy walidacji per element
- [CQRS — komendy i zapytania](./cqrs.md)
- [Zdarzenia domenowe i outbox](./events-outbox.md)
- [Synchronizacja w czasie rzeczywistym](./realtime-signalr.md)
- [Architektura backendu](./architecture.md)
