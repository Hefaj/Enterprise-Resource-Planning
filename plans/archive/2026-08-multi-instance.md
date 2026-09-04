---
id: architecture.multi-instance
title: Wieloinstancyjność — plan wdrożenia
summary: Reguły bezpiecznej pracy wielu instancji, dzierżawy, role Hub/Relay i Redis backplane.
kind: architecture
scope: backend
audience:
  - backend
  - agent
triggers:
  - skalowanie poziome lub druga instancja
  - cluster safe background service
related: []
---

# Wieloinstancyjność — plan wdrożenia

> **Status:** completed. Aktualny kontrakt architektoniczny opisuje
> `docs/architecture/multi-instance.md`.

Backend **nie zakłada już jednej instancji serwisu**. Ten dokument jest planem, według którego
założenie zostało zdjęte: co zmienić, w jakiej kolejności i **jak udowodnić**, że zadziałało.
Stan po zmianie opisuje [`architecture.md` §7](backend.md#7-wieloinstancyjność--założenia-zdjęte).

Stan: ✅ wdrożone, z dowodami. Rozjazdy między planem a kodem — świadome, z uzasadnieniem —
zebrane w [§11](#11-odstępstwa-od-planu); dwa z nich to usterki wykryte dopiero przez testy. Legenda znaczników jak w
[`architecture.md` §1](backend.md#1-stan-wdrożenia).

---

## 1. Zasada przewodnia

**Każda faza musi zostawić działającą jedną instancję, zachowując się dokładnie tak jak dziś.**

To nie jest ostrożnościowy frazes, tylko warunek wykonalności. Dev chodzi na jednej instancji
i będzie chodził dalej; plan, który wymaga postawienia Redisa i load balancera, żeby uruchomić
`dotnet run --project Catalog.Api`, zostanie porzucony po tygodniu. Stąd konsekwentnie:

- nowe zachowanie za flagą konfiguracji, z domyślną wartością odtwarzającą dzisiejszy stan;
- żadna faza nie dokłada zależności infrastrukturalnej wymaganej lokalnie (Redis wchodzi
  dopiero w fazie 4 i **tylko** dla Notification, i tylko gdy `Realtime:Role != Both`);
- każda faza kończy się testem, który przy jednej instancji też przechodzi.

Druga zasada: **Redis pozostaje w dokładnie jednym miejscu.** Backplane SignalR jest jedyną
rzeczą, której Postgres nie potrafi zrobić (SignalR nie ma backplane'u na Postgresie). Wszystko
inne — dzierżawy, liczniki, koordynacja startu — idzie przez Postgresa, który już jest
transakcyjnym źródłem prawdy. Zewnętrzny lock obok `job.status` byłby drugim źródłem prawdy,
zdolnym się z nim rozjechać.

---

## 2. Kolejność i dlaczego właśnie taka

Kluczowa obserwacja, której [§7](backend.md#7-wieloinstancyjność--założenia-zdjęte) nie mówi wprost:
**„razem" dotyczy wnętrza realtime, nie całego backendu.** Cztery punkty SignalR (rozgłaszanie,
licznik, koalescencja, próg) trzeba wdrożyć jednym ruchem, bo częściowe wdrożenie wygląda jak
gotowość, a nią nie jest. Ale runnery, start procesu i cache uprawnień są od nich niezależne.

Z tego wynika stan pośredni, który jest sam w sobie użyteczny:

> Po fazach 0–3 **Catalog, Sales i Identity dają się skalować poziomo**, a Notification zostaje
> na jednej instancji. To serwisy niosące ruch żądań; Notification jest w istocie fan-outem
> WebSocketów i skaluje się jako ostatni, bo jest najtrudniejszy i najmniej pilny.

| Faza | Zakres | Odblokowuje | Nowa infrastruktura | Stan |
|---|---|---|---|---|
| 0 | Fundament: dzierżawa, test architektoniczny, profil compose | — | brak | ✅ |
| 1 | Runnery zadań i eksportów | wiele instancji Catalogu *w tle* | brak | ✅ |
| 2 | Start procesu: migracje, seedy, reconciler | bezpieczny równoległy start | brak | ✅ |
| 3 | Cache uprawnień i wymuszone wylogowanie | Catalog/Sales/Identity ×N | brak (RabbitMQ już jest) | ✅ |
| 4 | Realtime: rola Hub/Relay, licznik, backplane, front | Notification ×N | **Redis** | ✅ |
| 5 | Wolverine multi-node, load balancer, dokumentacja | wdrożenie | LB | ✅ |

Wszystkie fazy są wdrożone, a dowody z [§10](#10-kryteria-akceptacji) chodzą na Testcontainers.
Otwarte zostaje jedno: rozgłaszanie SignalR przez backplane nie ma testu automatycznego i wymaga
sprawdzenia ręcznego profilem
[`docker-compose.multi.yml`](../../backend/docker-compose.multi.yml).

---

## 3. Faza 0 — fundament

Nic nie zmienia w zachowaniu. Buduje trzy rzeczy, z których korzystają wszystkie kolejne fazy.

### 3.1 `IExclusiveLease` — dzierżawa na advisory locku Postgresa

Trzy usługi tła (audytor mediów, sprzątacz nadań, reconciler katalogu uprawnień) potrzebują
tego samego: *„jeśli ktoś inny to już robi, odpuść ten przebieg"*. Jeden wspólny helper
w `Erp.BuildingBlocks.Persistence`:

```csharp
public interface IExclusiveLease
{
    /// <summary>Próbuje wziąć wyłączność na nazwany zasób. Zwraca null, gdy trzyma ją ktoś inny.
    /// Zwrócony obiekt trzeba zwolnić (Dispose) — a jeśli proces padnie, sesja Postgresa ginie
    /// razem z nim i lock puszcza SAM.</summary>
    Task<IAsyncDisposable?> TryAcquireAsync(string resource, CancellationToken cancellationToken);
}
```

Implementacja: `pg_try_advisory_lock(hashtext(@resource))` na **dedykowanym połączeniu**
trzymanym przez czas dzierżawy (advisory lock sesyjny puszcza przy zamknięciu połączenia).

**Dlaczego advisory lock, a nie kolumna `locked_until` w tabeli.** Dzierżawa z terminem wymaga
odpowiedzi na pytanie „co, gdy właściciel padł, a termin jeszcze nie minął" — czyli heartbeatu,
tolerancji na rozjazd zegarów i procedury odzysku osieroconych dzierżaw. Advisory lock nie ma
tego problemu z definicji: właściciel przestaje istnieć razem ze swoją sesją TCP. Kolumna jest
potrzebna dokładnie tam, gdzie praca trwa dłużej, niż wolno trzymać otwartą transakcję — czyli
w eksporcie (patrz [§4.2](#42-exportrunner--krótkie-przejęcie-i-heartbeat)) i nigdzie indziej.

### 3.2 Test architektoniczny — usługi tła

W duchu `Erp.ArchitectureTests`: reguła zapisana wyłącznie w dokumencie prędzej czy później
przestaje obowiązywać. Nowy test skanuje solucję w poszukiwaniu `BackgroundService`/`IHostedService`
i wymaga, żeby **każda** znaleziona klasa albo była oznaczona `[ClusterSafe(powód)]`, albo
figurowała na jawnej liście wyjątków w samym teście.

Efekt: dopisanie nowej usługi tła zapala czerwone światło w buildzie i zmusza autora do
świadomej odpowiedzi „co ta usługa robi, gdy chodzą dwie". Dziś takich usług jest 13 i żadna
tej odpowiedzi nie ma zapisanej w kodzie.

### 3.3 Profil `docker-compose` z wieloma instancjami

`backend/docker-compose.multi.yml` — nadpisanie stawiające 2× Catalog za nginxem, plus (od fazy 4)
Redis i rozbicie Notification na role (przekaźnik + 2× hub). Bez tego żadna faza nie ma jak być
zweryfikowana inaczej niż przez czytanie kodu.

Docelowy kształt profilu (Identity w komplecie, jednorazowe rozgrzanie cache'u pakietów, stały
emitent Keycloaka) i pięć potknięć, które go wymusiły, opisuje
[§8.3](#83-profil-wieloinstancyjny--co-wyszło-przy-pierwszym-uruchomieniu).

---

## 4. Faza 1 — runnery

### 4.1 `BulkCommandRunner` — SKIP LOCKED na wyborze zadania

Dziś [`ProcessNextChunkAsync`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/BulkCommandRunner.cs)
bierze najstarsze `Pending`/`Running` bez żadnej wyłączności, a właściwe wykonanie dzieje się
w `TryProcessAsync` — w **osobnym scope i osobnej transakcji**. Dwa runnery biorą to samo
zadanie i te same elementy.

Docelowy kształt — jedna transakcja obejmująca wybór i wykonanie chunka:

```sql
BEGIN;
  SELECT * FROM catalog.job
   WHERE kind = 'Map' AND status IN ('Pending','Running')
   ORDER BY created_at
   FOR UPDATE SKIP LOCKED
   LIMIT 1;
  -- …pobranie chunka job_item, wykonanie, RecordChunkResult, outbox…
COMMIT;                      -- tu puszcza lock
```

Cztery konsekwencje, każda warta odnotowania:

1. **Lock puszcza commit, a przy awarii — zerwana sesja.** Żadnych osieroconych dzierżaw,
   żadnego heartbeatu, żadnej reguły odzysku. To jest cały powód, dla którego blokujemy wiersz
   zadania, a nie zapisujemy w nim właściciela.
2. **`SKIP LOCKED` na *zadaniu*, nie na elementach.** Blokada samego wiersza `job` bez `SKIP LOCKED`
   sprawiłaby, że wszystkie runnery ustawiają się w kolejce do tego samego, najstarszego zadania
   i flota degeneruje się do jednego pracującego procesu. Z `SKIP LOCKED` runner B pomija zajęte
   zadanie i bierze następne: **N runnerów pracuje nad N zadaniami**, jeden runner na zadanie.
3. **Współbieżność wewnątrz jednego zadania jest świadomie odpuszczona.** Dałoby się ją mieć,
   blokując elementy (`FOR UPDATE SKIP LOCKED` na `job_item`) zamiast zadania — ale wtedy dwa
   runnery aktualizują liczniki tego samego wiersza `job`, `xmin` wyłapuje konflikt na
   `SaveChanges`, chunk wpada w ścieżkę izolacji „element po elemencie" i przepustowość leci
   na łeb. To dokładnie ta patologia, którą [§7](backend.md#7-wieloinstancyjność--założenia-zdjęte)
   opisuje jako „wygląda jak awaria bazy". Alternatywa — liczniki przez `UPDATE … SET
   succeeded_count = succeeded_count + @n`, poza `xmin` i poza metodą agregatu — jest możliwa,
   ale to ustępstwo w modelu domenowym i wchodzi dopiero wtedy, gdy pojedyncze wielkie zadanie
   faktycznie okaże się wąskim gardłem.
4. **Refaktor granicy metod jest nieunikniony.** Wybór musi się przenieść do środka transakcji
   `TryProcessAsync` — dzisiejszy podział (wybór w jednym scope, wykonanie w drugim) jest
   niekompatybilny z trzymaniem locka.

**Ryzyko implementacyjne — rozstrzygnięte.** `IUnitOfWork` deleguje zapis do
`IIntegrationEventPublisher.SaveChangesAndFlushAsync`, czyli do Wolverine'a, a ten po zapisaniu
kopert **sam zatwierdza bieżącą transakcję** kontekstu (musi, bo dopiero po commicie wolno mu
wypchnąć komunikaty na brokera). Jawny commit runnera trafiłby więc w transakcję, której już nie
ma. Runner sprawdza zamiast tego `Database.CurrentTransaction` i domyka ją tylko wtedy, gdy nadal
istnieje — co jest poprawne niezależnie od tego, po której stronie leży commit, i przy okazji
obsługuje chunk, w którym nie było nic do zapisania (zamknięcie pustego zadania).

**Schemat w SQL-u.** `BulkCommandRunner<TContext>` jest generyczny po module, więc nazwa schematu
nie może być wpisana na sztywno. Precedens jest w repo —
[`IJobItemBulkWriter`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/IJobItemBulkWriter.cs)
składa polecenie `COPY` z modelu EF przez `entityType.GetSchema()`. Ta sama droga.

Uwaga przy `FromSql`: **nie wolno komponować LINQ na wyniku** (`.Where()`, `.OrderBy()` po
`FromSql`). EF opakuje surowe zapytanie w podzapytanie, a `FOR UPDATE` w podzapytaniu nie robi
tego, co się wydaje. Zapytanie musi wyjść z bazy gotowe.

### 4.2 `ExportRunner` — krótkie przejęcie i heartbeat

Tu ten sam wzorzec **nie zadziała**, i to jest różnica, której
[§7](backend.md#7-wieloinstancyjność--założenia-zdjęte) nie rozdziela: przebieg eksportu strumieniuje
50 tys. rekordów do MinIO. Trzymanie transakcji Postgresa przez cały ten czas oznacza
długowieczny snapshot blokujący `VACUUM` — lekarstwo gorsze od choroby.

Kształt dla eksportu jest więc dwuczęściowy:

1. **Krótka transakcja przejęcia**: `SELECT … WHERE status = 'Pending' … FOR UPDATE SKIP LOCKED
   LIMIT 1`, `MarkStarted()`, `COMMIT`. Milisekundy.
2. **Długa praca poza transakcją**, z **biciem serca**: nowa kolumna `export_run.heartbeat_at`
   odświeżana przy każdym zapisie postępu (jest już co `ProgressBatchSize` = 500 rekordów, więc
   nie dokładamy ruchu do bazy — dopisujemy pole do istniejącego `UPDATE`).
3. **Reguła odzysku**: przebieg w stanie `Running`, którego `heartbeat_at` jest starszy niż
   próg, wraca do `Pending`. Bez tego padnięcie runnera w połowie eksportu zostawia przebieg
   `Running` na zawsze — co, warto zauważyć, **jest prawdą już dziś**, przy jednej instancji.
   Ta faza naprawia więc istniejącą usterkę przy okazji.

Skutek pominięcia tego kroku jest gorszy niż przy zadaniach masowych: dwa runnery wyprodukowałyby
dwa artefakty dla jednego przebiegu, z których jeden zostałby osierocony w magazynie — bez wiersza,
który by o nim wiedział, więc i bez szans na posprzątanie inaczej niż regułą lifecycle.

### 4.3 Usługi cykliczne — dzierżawa z fazy 0

| Usługa | Traktowanie |
|---|---|
| [`MediaReconciliationService`](../../backend/modules/Catalog/Catalog.Infrastructure/Jobs/MediaReconciliationService.cs) | `TryAcquireAsync("catalog:media-reconciliation")`; brak dzierżawy → pomiń przebieg. Tygodniowy cykl, pominięcie jest bez znaczenia. |
| [`ExpiredGrantCleanupService`](../../backend/modules/Identity/Identity.Infrastructure/Jobs/ExpiredGrantCleanupService.cs) | To samo. Samo odbieranie ról jest idempotentne, ale wpisy w `grant_audit` **nie są** — bez dzierżawy audyt dostaje duplikaty. |
| [`IdempotencyCleanupService`](../../backend/building-blocks/Erp.BuildingBlocks.Persistence/Idempotency/IdempotencyCleanupService.cs) | **Bez zmian.** Jedno `ExecuteDelete` po wygasłych kluczach; druga instancja usuwa zero wierszy. Naturalnie bezpieczna. |

---

## 5. Faza 2 — start procesu

**Ta kategoria nie figuruje dziś w [§7](backend.md#7-wieloinstancyjność--założenia-zdjęte) w ogóle**,
a niesie najostrzejsze ryzyko z całej listy — nie nieaktualny UI, tylko potencjalnie uszkodzony
schemat bazy.

Sześć usług startowych dotyka bazy przy każdym starcie procesu:
[`ErpDatabaseMigrator<T>`](../../backend/building-blocks/Erp.BuildingBlocks.Persistence/ErpDatabaseMigrator.cs),
`CatalogDatabaseInitializer`, `SalesSeedInitializer`, `RoleSeedInitializer`,
[`PermissionCatalogReconciler`](../../backend/modules/Identity/Identity.Infrastructure/Seed/PermissionCatalogReconciler.cs),
`ArtifactBucketInitializer`. Przy równoległym starcie N instancji:

- **Migracje EF** — dwa równoległe `MigrateAsync` wchodzą sobie w `__EFMigrationsHistory`.
  W najgorszym razie schemat zostaje w połowie zastosowany, a to jest awaria wymagająca ręcznej
  naprawy bazy.
- **`PermissionCatalogReconciler`** — chodzi przy **każdym** starcie, nie tylko na pustej bazie
  (katalog uprawnień jest kodem i musi się uzgadniać). Równolegle: wyścigi na `INSERT`
  i naruszenia unikalności.
- **Seedy** — duplikaty albo naruszenia unikalności.
- **`ArtifactBucketInitializer`** — `MakeBucket` równolegle; do sprawdzenia, czy połyka
  `BucketAlreadyOwnedByYou`. Najprawdopodobniej nieszkodliwe, ale to trzeba wiedzieć, a nie zakładać.

Rozwiązanie dwutorowe:

1. **Postawa produkcyjna**: `Database:MigrateOnStartup = false`, migracje jako osobny krok
   wdrożenia (`dotnet ef database update` albo bundle uruchamiany przed rolloutem instancji).
   Flaga już dziś deklaruje się jako „wygoda deweloperska, nie wzorzec produkcyjny" — ta faza
   tę deklarację egzekwuje.
2. **Dzierżawa dla reszty**: seedy i reconciler pod `IExclusiveLease` z fazy 0, tu jednak
   w wariancie **blokującym** (`pg_advisory_lock`, nie `try`) — praca jest krótka, a instancja B
   ma poczekać i zobaczyć uzgodniony stan, nie pominąć krok. Wymaga dopisania metody
   `AcquireAsync` obok `TryAcquireAsync`.

---

## 6. Faza 3 — uprawnienia i wymuszone wylogowanie

Dziś [`HttpPermissionProvider`](../../backend/building-blocks/Erp.BuildingBlocks.Api/Auth/PermissionProvider.cs)
trzyma uprawnienia w `IMemoryCache` per proces z TTL 60 s, a `InvalidateAsync` (wołane przy
wymuszonym wylogowaniu) czyści **tylko ten proces, który obsłużył żądanie**.

### Wybór: zdarzenia, nie współdzielony cache

| Wariant | Ocena |
|---|---|
| Wspólny cache w Redisie (`IDistributedCache`) | Wkłada Redisa na ścieżkę **każdego żądania każdego serwisu**, i to w warstwie autoryzacji. Awaria Redisa musi mieć wtedy zaprojektowaną degradację, inaczej pada cały ERP. Odrzucone. |
| **Zdarzenie unieważniające + lokalny `IMemoryCache`** | Szybka ścieżka zostaje w pamięci procesu. Propagacja idzie RabbitMQ, który już jest zależnością każdego serwisu. **Wybrane.** |
| Nic nie robić | TTL 60 s ogranicza ekspozycję niezależnie od liczby instancji — ale wymuszone wylogowanie przestaje być natychmiastowe, a to jest funkcja bezpieczeństwa. Odrzucone. |

### Rzecz, którą łatwo tu przeoczyć

Zwykłe zdarzenie integracyjne **nie zadziała**. Wymiana `erp.events` jest fanoutowa, ale wiąże
**jedną nazwaną kolejkę per serwis** (`Messaging:ListenQueueName`) — więc N instancji Catalogu to
*competing consumers*: komunikat dotrze do **jednej** z nich. Unieważnienie cache musi trafić do
**wszystkich**, a to jest inny wzorzec routingu.

Rozwiązanie: osobna kolejka **per instancja** (`exclusive`, `auto-delete`, nazwa
`{serwis}.cache.{instanceId}`) związana z tą samą wymianą. Kolejka umiera razem z instancją, więc
nie zostawia śmieci w brokerze. To jedyne miejsce w systemie, gdzie chcemy prawdziwego broadcastu
zamiast rozdziału pracy — i warto to nazwać, żeby wzorzec nie rozlał się na resztę handlerów.

### Właściwość, która czyni tę fazę bezpieczną

Zdarzenie jest **optymalizacją czasu reakcji, nie warunkiem poprawności**. Gwarancją pozostaje
TTL = 60 s. Jeśli kolejka unieważnień się zepsuje, system wraca do dzisiejszego zachowania —
ta faza nie może pogorszyć postawy bezpieczeństwa, może ją tylko poprawić.

Bez zmian zostaje: **wydany token JWT pozostaje ważny do naturalnego wygaśnięcia**, bo nie ma
introspekcji tokenu. Liczba instancji nic tu nie zmienia; odwołanie sesji w Keycloaku działa po
stronie IdP niezależnie od fleety.

---

## 7. Faza 4 — realtime (jedna niepodzielna zmiana)

Cztery punkty naraz. Wdrożenie częściowe wygląda jak gotowość i nią nie jest — to jest ostrzeżenie
z [§7](backend.md#7-wieloinstancyjność--założenia-zdjęte) i tutaj obowiązuje dosłownie.

### 7.1 Rozdzielenie ról: Hub i Relay

Sednem problemu jest to, że
[`RealtimeBroadcaster`](../../backend/modules/Notification/Notification.Api/Realtime/RealtimeBroadcaster.cs)
robi jednocześnie dwie rzeczy o sprzecznych wymaganiach: **decyduje**, co wysłać (koalescencja,
próg, sekwencja — wymaga *jednego* miejsca, żeby próg w ogóle miał sens) i **wysyła** (wymaga
*wielu* miejsc, bo tam siedzą WebSockety).

Rozdzielamy je konfiguracją `Realtime:Role`:

| Rola | Co robi | Ile instancji |
|---|---|---|
| `Relay` | Konsumuje `AggregateChanged` z `notification.events`, koalescuje, liczy sekwencję, decyduje o progu, wysyła gotową decyzję przez `IHubContext` → backplane | **dokładnie 1** |
| `Hub` | Wystawia `/hubs/sync`, obsługuje `Subscribe`/`Unsubscribe`, **nie konsumuje z brokera** (`ListenQueueName` puste) | N |
| `Both` | Jedno i drugie — **dzisiejsze zachowanie, wartość domyślna** | 1 |

To rozwiązanie **jednym ruchem zamyka problem competing consumers**: skoro huby nie słuchają
kolejki, nie ma czego dzielić między instancje, a bufor koalescencji i próg działają dokładnie
tak jak dziś — bo faktycznie *są* jednoinstancyjne. Zachowujemy semantykę zamiast ją odtwarzać
w rozproszeniu, a rozproszone okno koalescencji (kto jest właścicielem timera? kto scala bufory?)
jest zadaniem znacznie trudniejszym niż na to wygląda.

Koszt do przyjęcia świadomie: **Relay staje się pojedynczym punktem awarii realtime** *i* repliki
zadań (handlery `JobAccepted`/`JobProgressed`/`JobCompleted` też siedzą na tej kolejce). Nie gubi
to jednak danych — kolejka jest trwała, komunikaty czekają, a po restarcie Relay nadrabia. Awaria
degraduje UI do „odśwież ręcznie" i wstrzymuje historię zadań, co jest tą samą klasą skutku,
którą realtime ma już dziś zapisaną jako „wygoda, nie gwarancja".

Wariant, gdy osobne wdrożenie jest operacyjnie niewygodne: rola Relay przydzielana przez
**elekcję lidera na advisory locku** z fazy 0 — jedna instancja z fleety trzyma lock i pełni rolę
przekaźnika, przy jej awarii przejmuje następna. Kosztem jest krótkie okno podwójnego lidera przy
przełączeniu (duplikaty wiadomości — nieszkodliwe, front jest idempotentny; próg rozjechany —
przez sekundy, nie stale). Osobne wdrożenie jest prostsze i daje ścisłą semantykę progu, więc jest
wariantem podstawowym.

### 7.2 Licznik sekwencji → Postgres (rewizja wcześniejszej decyzji)

[`architecture.md` §7 „Kierunki naprawy"](backend.md#7-wieloinstancyjność--założenia-zdjęte)
wskazuje na `INCR` w Redisie. **Ten plan tę decyzję zmienia** i powód jest konkretny.

Dzisiejsze uzasadnienie, dlaczego licznik może być ulotny
(licznik w pamięci procesu, `SignatureSequenceTracker` — klasa usunięta razem z tą zmianą),
brzmi: restart zeruje licznik, ale zrywa też **wszystkie** połączenia SignalR, więc każdy klient
wraca przez `Subscribe` z zapamiętanym `lastSeenSequence`, serwer pokazuje `0`, rozjazd zostaje
wykryty jako luka i wymusza resync. Rozumowanie jest poprawne i opiera się na tym, że licznik
i połączenia **giną razem**.

Po rozdzieleniu ról to przestaje być prawdą. Restart Relaya nie zrywa połączeń — te wiszą na
Hubach. Gdyby licznik żył w Redisie bez trwałości, wyglądałoby to tak:

1. Relay wstaje, licznik dla sygnatury wraca do `0`.
2. Klient trzyma `lastSeenSequence = 850`, połączenie nietknięte.
3. Kolejne zdarzenia dostają numery `1, 2, 3…` — **klient już takie widział**.
4. Przy następnym `Subscribe` porównanie `850 ≠ 3` daje resync (fałszywie dodatni, znośne).
   Ale przy **braku** ponownej subskrypcji luka nie zostanie zauważona w ogóle — to jest ten
   gorszy przypadek, przed którym mechanizm miał chronić.

Czyli: **licznik musi przeżyć proces, który go zwiększa.** Tabela w schemacie `notification`
daje to bez nowej infrastruktury i bez pytania o konfigurację trwałości Redisa:

```sql
INSERT INTO notification.signature_sequence (signature, value) VALUES (@sig, 1)
ON CONFLICT (signature) DO UPDATE SET value = signature_sequence.value + 1
RETURNING value;
```

Atomowe, więc poprawne nawet gdyby Relayów przejściowo było dwóch. Zapis raz na okno koalescencji
(najwyżej ~5/s na sygnaturę), odczyt przez Hub tylko przy `Subscribe` — koszt pomijalny.
Redis zostaje wyłącznie backplanem, zgodnie z zasadą z [§1](#1-zasada-przewodnia).

### 7.3 Backplane Redis

`Microsoft.AspNetCore.SignalR.StackExchangeRedis` **jest już w**
[`Directory.Packages.props`](../../backend/Directory.Packages.props) z komentarzem odsyłającym
do tej fazy. Zostaje `AddStackExchangeRedis(...)` warunkowe względem konfiguracji i usługa Redis
w profilu compose z fazy 0.3.

Grupy (`agg:`, `user:`, `client:`) nie wymagają żadnej zmiany — backplane routuje wysyłki do grup
między instancjami sam.

### 7.4 Frontend — negocjacja

Problem, którego nie widać w kodzie backendu: uzgadnianie SignalR (`negotiate`) zwraca token
połączenia związany z **instancją, która je obsłużyła**. Za load balancerem bez powinowactwa sesji
kolejne żądanie trafia gdzie indziej i połączenie nie wstaje.

Dwie drogi. Wybieramy tę, która **usuwa** wymaganie infrastrukturalne zamiast dokładać:

```ts
// signalr-sync.service.ts — _initConnection()
.withUrl(`${this._hubUrl}?clientId=${encodeURIComponent(clientId)}`, {
  accessTokenFactory: () => this._accessTokenFactory() ?? '',
  skipNegotiation: true,
  transport: signalR.HttpTransportType.WebSockets,
})
```

Bez negocjacji nie ma stanu do przyklejenia, więc powinowactwo sesji przestaje być potrzebne.
Cena: znika fallback na SSE/long-polling — WebSockety muszą działać na całej drodze sieciowej.

Uwierzytelnianie działa bez zmian: przy transporcie WebSocket token i tak idzie w query stringu
`access_token`, a `ErpAuthExtensions.OnMessageReceived` już go stamtąd czyta — mechanizm jest
w miejscu, nie trzeba go dokładać.

Powinowactwo sesji na LB warto mimo to skonfigurować, jeśli środowisko docelowe je oferuje —
jako pas obok szelek, nie jako warunek działania.

---

## 8. Faza 5 — Wolverine, LB, domknięcie

### 8.1 Wolverine w trybie wielowęzłowym — zweryfikowane

Outbox Wolverine'a na Postgresie ma własną rejestrację węzłów i elekcję dla swoich agentów
trwałości. Plan wprost odmawiał opierania się na „powinno działać z pudełka" — i słusznie, bo
weryfikacja wykryła dwie usterki, których przegląd kodu nie złapał (obie opisane w
[§11](#11-odstępstwa-od-planu)).

Test `MultiNodeMessagingTests` stawia dwa węzły nad jednym Postgresem i jednym RabbitMQ
(Testcontainers) i sprawdza:

- **kopertę wysłaną raz, nie dwa** — 50 zdarzeń przez outbox dociera łącznie 50 razy; podwojenie
  byłoby najbardziej prawdopodobnym objawem braku elekcji dla agenta odzysku;
- **rozgłoszenie docierające do obu węzłów** — i niewpadające przy okazji na kolejkę roboczą.

Wynik: **outbox wielowęzłowo działa bez zmian w konfiguracji.** Rejestracja węzłów i przydział
agentów trwałości robią swoje same.

### 8.2 Kod handlerów generowany z wyprzedzeniem

Wolverine domyślnie generuje kod handlerów Roslynem przy starcie (`TypeLoadMode.Dynamic`).
Przy równoległym starcie kilku instancji jest to jeszcze jedna rzecz robiona N razy, i jeszcze
jedno miejsce, w którym instancje mogą sobie wejść w drogę na plikach.

Przełącznik jest gotowy:

```bash
dotnet run --project modules/Catalog/Catalog.Api -- codegen write
```

Kod ląduje w `Internal/Generated/WolverineHandlers/` projektu Api i jest **zatwierdzony
w repozytorium**. `Messaging:PrecompiledHandlers=true` przełącza Wolverine'a na
`TypeLoadMode.Static`, czyli ładowanie gotowych typów z zestawu — bez Roslyna, bez generowania,
bez wyścigu. Profil [`docker-compose.multi.yml`](../../backend/docker-compose.multi.yml) ma to
włączone.

Uruchomienie serwisów przechodzi teraz przez `RunJasperFxCommands(args)` zamiast `RunAsync()`.
Bez argumentów zachowanie jest identyczne; różnica polega na tym, że komenda `codegen` w ogóle
istnieje.

> **Flaga jest domyślnie wyłączona i to jest świadome.** Zatwierdzony kod trzeba regenerować przy
> **każdej** zmianie kształtu handlera — nowej zależności, nowej sygnaturze, nowym handlerze.
> Rozjazd zwykle kończy się błędem przy starcie, ale **nie zawsze**: gdy Wolverine szuka typów
> w niewłaściwym zestawie, serwis wstaje zdrowy, a każdy handler przelatuje z
> `ExpectedTypeMissingException` w logu ([§11](#11-odstępstwa-od-planu)). Włączenie
> flagi to decyzja wdrożenia (gdzie start liczy się w sekundach, a obraz ma być bez kompilatora),
> a nie stan domyślny repozytorium, w którym handlery wciąż się zmieniają.

### 8.3 Profil wieloinstancyjny — co wyszło przy pierwszym uruchomieniu

Profil [`docker-compose.multi.yml`](../../backend/docker-compose.multi.yml) stawia 2× Catalog za
nginxem, Identity, przekaźnik i 2× hub z backplanem Redis. Pierwsze uruchomienie wywróciło się
pięć razy i **każde z tych potknięć było prawdziwe** — żadne nie wynikało z tego, że „test jest
sztuczny". Warto je znać, bo wszystkie wracają przy każdym wdrożeniu wieloinstancyjnym:

| Objaw | Przyczyna | Rozwiązanie |
|---|---|---|
| `Could not find file '.../acg4uxhj.h3r'` przy losowym pakiecie | Pięć kontenerów rozpakowuje pakiety NuGet do jednego wolumenu naraz | Jednorazowa usługa `restore`, od której zależą wszystkie instancje |
| 401 na `/hubs/sync` mimo poprawnego tokenu | Token ma `iss = localhost:8080` (tam loguje się przeglądarka), a serwis w kontenerze ufa `keycloak:8080` | `KC_HOSTNAME` przypina publiczny emitent, a `Keycloak:MetadataAddress` pozwala serwisowi dociągnąć metadane ścieżką wewnętrzną |
| Port Catalogu zwraca odpowiedzi Notification | nginx rozwiązuje nazwy upstreamów **raz, przy starcie**; odtworzony kontener dostaje nowy adres, a stary bywa już zajęty przez inną usługę | Restart nginxa po każdym `--force-recreate` (opisane w [`nginx/multi.conf`](../../backend/nginx/multi.conf)) |
| 403 na każdym zapisie | Bez Identity nie ma kogo zapytać o uprawnienia, a `HttpPermissionProvider` fail-closed zwraca pusty zbiór | Identity dołożone do profilu |
| Handlery nie działają, choć serwis wstaje | `TypeLoadMode.Static` szukał wygenerowanych typów w zestawie fundamentu zamiast w Api — patrz [§11](#11-odstępstwa-od-planu) | `WolverineOptions.ApplicationAssembly` ustawiane jawnie |

**Dowód backplane'u.** Dwaj klienci SignalR z `skipNegotiation: true`, posadzeni <b>celowo</b> na
dwóch różnych hubach (porty `5251`/`5252` wystawione właśnie po to — round-robin nie gwarantuje
rozdzielenia i pierwsze podejście posadziło obu na tej samej instancji, czyli sprawdziło zupełnie
co innego). Zmiana nazwy produktu zlecona przez load balancer na jednej z dwóch instancji Catalogu
dotarła do **obu** klientów, razem z kanałem `jobs`. Cała droga: Catalog → RabbitMQ → przekaźnik
(koalescencja, sekwencja, próg) → `IHubContext` → Redis → oba huby → klienci.

### 8.4 Domknięcie dokumentacji

[`architecture.md` §7](backend.md#7-wieloinstancyjność--założenia-zdjęte) nie opisuje już
stanu faktycznego jako jednoinstancyjnego — jest opisem **zdjętych** założeń, z odesłaniem tutaj.
Adnotacje w kodzie mówiące „zakłada jedną instancję" zostały zdjęte razem ze zmianą, a nie
później: komentarz kłamiący o współbieżności jest gorszy niż brak komentarza. Każda usługa tła
niesie dziś `[ClusterSafe]` z opisem mechanizmu, który ją zabezpiecza.

---

## 9. Czego nie ruszamy

Te miejsca są gotowe na wiele instancji i to nie przypadek — w każdym świadomie wybrano trwałość
zamiast pamięci procesu. Dotykanie ich w ramach tego planu byłoby zmianą bez powodu:

- **Outbox i RabbitMQ** — koperta zapisuje się w transakcji danych ([`events-outbox.md`](integration-events.md)).
- **`job` / `job_item` w bazie** — zadanie przeżywa restart; brakowało wyłącznie wyłączności przy
  *wyborze*, nie trwałości. Faza 1 dokłada dokładnie to jedno.
- **Klucze idempotencji** — `EfIdempotencyStore` trzyma je w tabeli schematu modułu i zatwierdza
  w jednej transakcji ze skutkiem komendy. Działa między instancjami **już dziś**; komentarz
  w tym pliku wprost to przewiduje.
- **Strona odczytu** — bezstanowa, `AsNoTracking`, projekcja wprost do DTO.
- **`IdempotencyCleanupService`** — patrz [§4.3](#43-usługi-cykliczne--dzierżawa-z-fazy-0).
- **Cache frontendowy** — `IdentityMapStore` żyje w przeglądarce i jest inwalidowany zdarzeniami.

---

## 10. Kryteria akceptacji

Plan bez dowodu jest przypuszczeniem. Dowody leżą w
[`backend/tests/Erp.IntegrationTests`](../../backend/tests/Erp.IntegrationTests) i chodzą na
Testcontainers — Postgres i RabbitMQ startują z obrazów, więc CI nie potrzebuje żadnej
infrastruktury poza Dockerem, a testy nie mieszają swoich wyścigów z cudzymi.

Wspólny wzorzec: instancje startują **naraz**, przez barierę. Test współbieżności, w którym
uczestnicy rozjeżdżają się w czasie, przechodzi zawsze — i niczego nie dowodzi.

| Faza | Dowód | Test |
|---|---|---|
| 0 | Dzierżawa jest wyłączna, zwalnia się po oddaniu i — kluczowe — **sama po śmierci właściciela**: zerwana sesja TCP puszcza advisory lock bez niczyjego udziału. Wariant blokujący czeka, zamiast pomijać krok. | `ExclusiveLeaseTests` |
| 1 | **Dwa** `BulkCommandRunner` nad jednym Postgresem, zadanie na 5 tys. elementów: `succeeded + failed = total`, **zero** `job_item.error_code = 'concurrency_conflict'`, każdy agregat dotknięty **dokładnie raz** (licznik skutków ubocznych na agregacie, nie `attempts`). | `BulkCommandRunnerTests` |
| 1 | `SKIP LOCKED` daje obie własności naraz: zajęte zadanie jest **pomijane** (nie odbierane), a dwa wolne zadania trafiają do dwóch runnerów (nie kolejki do jednego). | `BulkCommandRunnerTests` |
| 1 | Przebieg eksportu przejmuje **dokładnie jeden** runner; przebieg po martwym runnerze wraca do `Pending` po progu bicia serca; przebieg **żywy** nie jest odzyskiwany. | `ExportRunConcurrencyTests` |
| 2 | Równoległy start **trzech** instancji na pustej bazie: komplet migracji, historia bez duplikatów, tabele odpowiadają na zapytania. Osobno: trzy instancje uzgadniające katalog uprawnień nie zostawiają duplikatów kodów. | `StartupRaceTests` |
| 3 | Unieważnienie uprawnień dociera do **obu** węzłów, a nie do jednego — i nie wpada przy okazji na kolejkę roboczą, gdzie byłoby komunikatem bez handlera. | `MultiNodeMessagingTests` |
| 4 | Licznik sekwencji przeżywa restart przekaźnika (`lastSeenSequence` się nie cofa), nieznana sygnatura daje zero, a równoległe inkrementacje nie gubią numerów. | `SignatureSequenceTests` |
| 5 | Dwa węzły Wolverine'a nad jednym Postgresem i RabbitMQ: 50 kopert wypuszczonych przez outbox dociera **dokładnie 50 razy** łącznie — agent odzysku nie dubluje wysyłki. | `MultiNodeMessagingTests` |

**Czego te testy nie obejmują.** Rozgłaszanie SignalR przez backplane Redis do klientów wiszących
na różnych hubach nie ma testu automatycznego — wymagałby trzech hostów ASP.NET, Redisa
i uwierzytelnionych klientów WebSocket, czyli kosztu nieproporcjonalnego do tego, że sprawdzałby
w istocie bibliotekę Microsoftu. Ta ścieżka została sprawdzona **ręcznie** profilem
[`docker-compose.multi.yml`](../../backend/docker-compose.multi.yml): dwaj klienci celowo
posadzeni na dwóch różnych hubach dostali zmianę zleconą przez load balancer
([§8.3](#83-profil-wieloinstancyjny--co-wyszło-przy-pierwszym-uruchomieniu)). Tak samo „dokładnie jeden
artefakt w MinIO": wynika wprost z „dokładnie jeden runner przejmuje przebieg", co ma dowód wyżej,
a dokładanie kontenera MinIO sprawdzałoby tę samą własność drożej.

---

## 11. Odstępstwa od planu

Cztery miejsca, w których kod świadomie różni się od tego, co zapisano wyżej. Każde ma powód —
plan nie jest tu dokumentem historycznym, tylko zapisem rozumowania, a różnica bez uzasadnienia
byłaby po prostu błędem.

**Kolejka broadcastu jest `exclusive` — i musi być.** Pierwsza wersja miała samo `auto-delete`
(bez wyłączności), w przekonaniu, że to wystarczy do sprzątania i unika ryzyka `RESOURCE_LOCKED`.
Test integracyjny wywrócił to natychmiast: **RabbitMQ 4 odrzuca kolejki nietrwałe i niewyłączne**
(`transient_nonexcl_queues` jest funkcją wycofaną i domyślnie niedozwoloną), a serwis nie wstaje
w ogóle. To jest dokładnie ta klasa błędu, dla której §10 wymaga dowodu, a nie przeglądu kodu:
kod wyglądał poprawnie i przechodził kompilację, a padał przy pierwszym kontakcie z brokerem
w wersji, która stoi w `docker-compose.yml`.

**Broadcast idzie osobną wymianą `erp.broadcast`, nie `erp.events`.** Plan mówił o „kolejce per
instancja związanej z tą samą wymianą". To by działało dla samego unieważnienia, ale kolejka
wpięta w `erp.events` dostaje **komplet** zdarzeń domenowych — a wtedy każdy handler modułu
odpalałby się dwa razy: raz z kolejki serwisu, raz z kolejki instancji. Stąd druga wymiana i typ
`PermissionsInvalidated` celowo umieszczony **poza** `Erp.BuildingBlocks.Contracts`, żeby reguła
„wszystko z tego zestawu na `erp.events`" go nie złapała.

**Handler broadcastu bierze jedną zależność, a nie `IEnumerable<IPermissionCacheInvalidator>`.**
Kolekcja implementacji jest naturalnym kształtem dla „rozdaj sygnał wszystkim cache'om" i była
pierwszą wersją. Wolverine od wersji 6 odrzuca ją jako *service location*: łańcuch handlera się
nie kompiluje, handler **nigdy się nie uruchamia**, a jedynym śladem jest wpis w logu przy starcie —
żadnego wyjątku, żadnego komunikatu w dead letters, po prostu cisza. Znalazł to ten sam test
integracyjny; między nim a przeglądem kodu nie było tu żadnej innej linii obrony. Rozdawaniem
zajmuje się teraz `PermissionCacheInvalidation`, wstrzykiwane jako jedna usługa.

**Sygnał unieważnienia publikuje `GrantAuditWriter`, a nie osiem handlerów komend.** Plan nie
wskazywał miejsca publikacji. Wybrane zostało to jedno, bo opiera się na niezmienniku, który już
obowiązuje: *każda zmiana tego, kto co może, zostawia wpis w `grant_audit`* — nadanie roli,
odebranie uprawnienia, dodanie członka, wygaśnięcie nadania, wymuszone wylogowanie. Rozsypanie
publikacji po handlerach dałoby osiem miejsc, w których dziewiąty handler może o niej zapomnieć.

**`TypeLoadMode.Static` wymaga jawnego wskazania zestawu aplikacji.** Wolverine za „zestaw
aplikacji" bierze ten, z którego wołane jest `UseWolverine` — czyli u nas fundament
(`Erp.BuildingBlocks.Messaging`), a nie projekt Api, do którego `codegen write` zapisuje kod.
W trybie dynamicznym nie ma to znaczenia (kod i tak powstaje w pamięci), więc rozjazd był
niewidoczny; w statycznym serwis **wstaje normalnie**, a każdy handler kończy się
`ExpectedTypeMissingException` wpisanym do logu — komunikaty przelatują bez obsługi, a aplikacja
raportuje pełne zdrowie. Naprawa to `WolverineOptions.ApplicationAssembly`; wykryło to dopiero
faktyczne uruchomienie profilu, bo test integracyjny chodzi w trybie dynamicznym.

**Migracje EF dostały blokującą dzierżawę, mimo że [§5](#5-faza-2--start-procesu) stawiał na
wyłączenie flagi.** Postawa produkcyjna się nie zmienia — `Database:MigrateOnStartup` jest
domyślnie wyłączone i schemat stosuje osobny krok wdrożenia. Ale flaga bywa włączona w devie,
w testach integracyjnych i w profilu `docker-compose.multi.yml`, a dwa równoległe `MigrateAsync`
zostawiają schemat zastosowany w połowie. Dzierżawa kosztuje jedno połączenie i zamyka sprawę
niezależnie od tego, jak flaga jest ustawiona.

---

## 12. Zobacz też

- [Architektura backendu §7](backend.md#7-wieloinstancyjność--założenia-zdjęte) — lista założeń, którą ten plan zdejmuje
- [Operacje masowe](../guides/backend/bulk-commands.md) — `job`/`job_item`, `BulkCommandRunner`
- [Eksporty i artefakty](../guides/backend/exports-artifacts.md) — `ExportRun`, `ExportRunner`
- [Synchronizacja w czasie rzeczywistym](realtime.md) §5–6 — licznik sekwencji, backplane
- [Tożsamość i uprawnienia](security.md) §4, §9 — cache uprawnień, wymuszone wylogowanie
- [Zdarzenia domenowe i outbox](integration-events.md) — dlaczego fanout ≠ broadcast
