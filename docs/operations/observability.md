---
id: operations.observability
title: Obserwowalność i niezawodność produkcyjna
summary: Health checks, metryki, alerty, korelacja i retencja telemetryczna.
kind: operations
scope: operations
audience:
  - operations
  - backend
  - agent
triggers:
  - obserwowalność produkcyjna
  - health check alert lub korelacja X-Request-Id
related: []
---

# Obserwowalność i niezawodność produkcyjna

Jak wykrywać awarie tego systemu i jak im zapobiegać. Dokument uzupełnia
[runbook produkcyjny](production.md) o kompletny zestaw narzędzi i sygnałów specyficznych dla
**tej** architektury, progi, i osobno rzeczy, które awarii **zapobiegają**, a nie tylko ją pokazują.

Kontrakt jest docelową specyfikacją operacyjną. Konkretne kroki wprowadzenia brakujących elementów
są śledzone w `plans/backlog/observability.md`, a ich dostępność potwierdza konfiguracja środowiska.

---

## 1. Zasada przewodnia

**Alert ma odpowiadać na pytanie „czy użytkownik to odczuje", nie „czy metryka drgnęła".**

Konsekwencje, które przewijają się przez cały ten dokument:

- każdy alert musi mieć **adresata i działanie**; alert, na który reakcją jest „no tak, znowu"
  wygasza czujność na wszystkie pozostałe;
- najgroźniejsze awarie tego systemu przebiegają **przy HTTP 200**. Outbox, który przestał
  wychodzić, martwy Relay i zadanie masowe wiszące w `Running` nie zapalają ani jednego 5xx.
  Monitoring oparty wyłącznie na kodach odpowiedzi ich nie zobaczy;
- monitoring stojący na tej samej maszynie co aplikacja umiera razem z nią, a cisza w alertach
  wygląda wtedy identycznie jak sprawny system. Stąd [§3.2](#32-czujka-z-zewnątrz).

---

## 2. Trzy sygnały i jedno miejsce

| Sygnał | Skąd | Odpowiada na pytanie |
|---|---|---|
| Logi strukturalne | `ILogger` (już jest wszędzie) + korelacja po `X-Request-Id` | *Co się stało w tym konkretnym żądaniu?* |
| Metryki | OpenTelemetry Metrics + zapytania do Postgresa | *Czy coś odjeżdża — i od kiedy?* |
| Ślady | OpenTelemetry Tracing: ASP.NET Core, HttpClient, EF Core, Wolverine | *Gdzie poszło żądanie i co trwało?* |

Instrumentacja: **OpenTelemetry SDK**, rejestrowany raz w `AddErpApi`/`UseErpApi` — dokładnie
z tego powodu, dla którego siedzą tam już CORS i uwierzytelnianie: żaden `Program.cs` nie może
tego pominąć po cichu. Eksport przez **OTLP**, co odrywa kod od wyboru backendu telemetrii —
zmiana backendu jest wtedy zmianą zmiennej środowiskowej, nie zmianą kodu.

Ślad `HTTP → komenda → outbox → konsument` to najczęstsza ścieżka diagnozy w tym systemie
i jedyna, której nie da się odtworzyć z logów pojedynczego serwisu. Wolverine sam zakłada
`Activity` na handlerach (widać to w wygenerowanym kodzie w `Internal/Generated`), więc
propagacja kontekstu przez RabbitMQ działa bez pisania czegokolwiek.

---

## 3. Wybór stosu

### 3.1 Backend telemetrii

Dla niewielkiego wdrożenia utrzymywanego przez jedną osobę:

| | **SigNoz** (rekomendacja) | Grafana + Alloy + Loki/Tempo/Prometheus | Grafana Cloud / Seq |
|---|---|---|---|
| Ruchome części | jeden stack, trzy sygnały, alerty w środku | 4–5 kontenerów do skonfigurowania i utrzymania | zero |
| OTLP | natywnie | przez collector | natywnie |
| Koszt | dysk na ClickHouse | dysk × 3 magazyny | darmowy tier / licencja |
| Kiedy wybrać | jeden serwer, jedna osoba utrzymująca — **to jest twój przypadek** | znasz już Grafanę albo planujesz klaster | nie chcesz administrować drugim systemem |

Rekomendacja to SigNoz albo darmowy tier w chmurze — **nie** samodzielnie składany stos Grafany.
Argument jest ten sam, którym [kontrakt wieloinstancyjności](../architecture/multi-instance.md#granice-odpowiedzialności)
odrzuca zależności wymagane lokalnie: narzędzie, którego utrzymanie jest projektem samym w sobie,
zostanie porzucone po miesiącu, a wtedy zostaje monitoring, któremu nikt nie ufa.

**Czego nie robić:** nie stawiać drugiego Postgresa ani drugiego Redisa „pod metryki". Redis ma
w tej architekturze dokładnie jedno zastosowanie (backplane SignalR) i ta granica jest
w [kontrakcie wieloinstancyjności](../architecture/multi-instance.md#granice-odpowiedzialności) postawiona świadomie.

### 3.2 Czujka z zewnątrz

**Osobna maszyna, poza tym serwerem.** Uptime Kuma (albo dowolny zewnętrzny monitor) sprawdzający
co minutę `https://domena/health/ready` i wysyłający powiadomienie na telefon.

To jest **pierwsza rzecz do postawienia**, przed jakąkolwiek telemetrią, i najtańsza w stosunku do
tego, co łapie: pad maszyny, wygasły certyfikat, padnięte proxy, wypełniony dysk. Wszystkie te
awarie mają wspólną cechę — wewnętrzny monitoring nie zdąży o nich powiedzieć, bo sam leży.

---

## 4. Health checks

Trzy endpointy, nie jeden, i podział między nimi jest **istotny**:

| Endpoint | Sprawdza | Kto pyta |
|---|---|---|
| `/health/live` | proces odpowiada — **żadnych zależności** | orkiestrator (restart kontenera) |
| `/health/ready` | Postgres odpowiada | proxy / load balancer (rotacja ruchu) |
| `/health/deps` | RabbitMQ, MinIO, Redis, Identity, Keycloak | monitoring i człowiek, **nigdy** proxy |

### Pułapka, przez którą `ready` kładzie cały system

Naturalny odruch to wpisać do `ready` wszystkie zależności. Jest to błąd, i to taki, który zamienia
częściową awarię w całkowitą.

Przy padzie RabbitMQ „bogaty" `ready` zwraca niezdrowy status na **wszystkich** instancjach
naraz, proxy wyrzuca je z rotacji i API przestaje odpowiadać — mimo że odczyty i większość zapisów
działają bez zarzutu, bo outbox jest właśnie po to, żeby pad brokera przetrwać
([`events-outbox.md`](../architecture/integration-events.md): koperta leży w bazie, dane są bezpieczne, stoi tylko
integracja). Sprawny mechanizm degradacji zostaje unieważniony przez health check.

Reguła: **do `ready` trafia wyłącznie to, bez czego instancja nie obsłuży żadnego żądania.**
To jest Postgres i nic więcej. Reszta idzie do `/health/deps`, które karmi alerty, a nie decyzje
load balancera.

Osobno: `ready` musi zwracać niezdrowy status **w trakcie wygaszania** (SIGTERM → `ready` fałszywy →
odczekanie na wypadnięcie z rotacji → dopiero potem zamykanie). Bez tego każdy deploy kroczący
gubi garść żądań w locie.

---

## 5. Co mierzyć

### 5.1 Warstwa ogólna (z instrumentacji, za darmo)

RED na HTTP (liczba żądań, udział błędów, czas odpowiedzi — per endpoint), czasy zapytań EF,
czas handlerów Wolverine, pula połączeń Npgsql, GC i pamięć procesu.

### 5.2 Sygnały specyficzne dla tej architektury

To jest sedno dokumentu. Poniższe rzeczy **nie mają objawów w HTTP** i żadne gotowe narzędzie
nie zapyta o nie samo.

#### a) Outbox przestał wychodzić

Wolverine trzyma koperty w schemacie `wolverine` (`ErpMessagingOptions.MessagingSchema`).
Rosnąca liczba niewysłanych kopert oznacza, że zdarzenia integracyjne nie opuszczają serwisu:
Notification nie dowie się o zadaniach, replika zadań stanie, realtime zamilknie.

```sql
select count(*) from wolverine.wolverine_outgoing_envelopes;
select count(*) from wolverine.wolverine_dead_letters;
```

Ważniejszy od licznika jest **wiek najstarszej koperty** — licznik potrafi stać w miejscu, gdy
przepustowość spadła do zera, ale napływ też. Kolumnę czasu trzeba dobrać do faktycznego schematu
Wolverine'a w używanej wersji (`\d wolverine.wolverine_outgoing_envelopes`) — nie zgadywać.

**Próg:** cokolwiek starszego niż 2 minuty, albo `wolverine_dead_letters` > 0.

#### b) Zadanie masowe wiszące i zadania nieudane

`job` i `job_item` leżą w schemacie modułu-właściciela (`catalog.job`, `identity.job`, …).
Statusy jako liczby — kolejność jest częścią kontraktu (`JobStatus` w `Erp.BuildingBlocks.Contracts`):
`Pending=0`, `Running=1`, `Completed=2`, `CompletedWithErrors=3`, `Failed=4`, `Cancelled=5`, `Draft=6`.

```sql
-- Zadania zakończone niepowodzeniem w ostatniej dobie.
select status, count(*)
from catalog.job
where status in (3, 4) and created_at > now() - interval '24 hours'
group by status;

-- Zadania podjęte i nieruszające się z miejsca — pad instancji w trakcie chunka.
select uuid, command_type, total_count, succeeded_count, failed_count, started_at
from catalog.job
where status = 1 and started_at < now() - interval '30 minutes';

-- Osierocone szkice: awaria między utworzeniem nagłówka a przełączeniem na Pending.
-- Nikt ich nie zobaczy i nikt ich nie wykona — i nikt ich dziś nie sprząta
-- (patrz JobStatus.Draft i bulk-commands.md §3).
select count(*) from catalog.job where status = 6 and created_at < now() - interval '1 hour';
```

Drugie zapytanie jest ważniejsze od pierwszego. Zadanie nieudane widzi użytkownik i zgłosi je;
zadanie wiszące w `Running` wygląda dla niego jak „jeszcze się liczy" i nie zgłosi go nigdy.

#### c) Przebieg eksportu po martwym runnerze

`ExportRunner` przejmuje przebieg krótko i bije serce w `catalog.export_run.heartbeat_at`; przebieg
po martwym runnerze wraca do `Pending` po przekroczeniu progu. Odzysk działa — ale **rosnąca liczba
odzysków** oznacza, że instancje padają w trakcie eksportów, co jest osobnym problemem do zbadania.

```sql
select count(*)
from catalog.export_run
where status = 1 and (heartbeat_at is null or heartbeat_at < now() - interval '5 minutes');
```

#### d) Realtime zamarł po cichu — liczba Relayów

Najbardziej podstępna awaria w tym systemie. Przy rozdziale ról
([`multi-instance.md` §7.1](../architecture/multi-instance.md)) huby (`Realtime:Role=Hub`) wystawiają
`/hubs/sync` i **nie konsumują z brokera**; konsumuje wyłącznie jeden `Realtime:Role=Relay`.

- **Zero żywych Relayów** — huby działają, klienci są połączeni, health checki zielone, a zmiany
  po prostu nie docierają. Wstrzymana jest też replika zadań (handlery `Job*` siedzą na tej samej
  kolejce). Objawia się jako „muszę odświeżać ręcznie" zgłaszane przez użytkowników po godzinie.
- **Dwa Relaye** — gorsze, bo nie boli od razu: licznik sekwencji i okno koalescencji zakładają
  jedno miejsce decyzyjne, więc rozjeżdżają się cicho.

Do dopisania: metryka-heartbeat wystawiana przez instancję z rolą `Relay`, z alertem **w obie
strony** (`!= 1`). Zastępczo, do czasu jej powstania: głębokość kolejki `notification.events`
w RabbitMQ rosnąca monotonicznie oznacza brak konsumenta.

#### e) Infrastruktura

| Co | Próg | Dlaczego akurat to |
|---|---|---|
| RabbitMQ: głębokość kolejek, unacked, dead-letter | dead-letter > 0; kolejka rosnąca 5 min | konsument padł albo zapętlił się na jednym komunikacie |
| Postgres: połączenia / limit | > 80% | pula Npgsql × liczba instancji łatwo przekracza `max_connections` |
| Postgres: transakcje > 30 s, oczekiwania na blokady | jakiekolwiek | długa transakcja blokuje `SKIP LOCKED` i wstrzymuje autovacuum |
| **Wolne miejsce na dysku** (Postgres, MinIO) | **75%** | statystycznie najczęstsza cicha awaria takich wdrożeń; przy 95% jest już za późno na spokojną reakcję |
| Rozmiar tabel rosnących monotonicznie: `job`, `job_item`, `grant_audit` | trend, nie próg | patrz [§7](#7-zapobieganie-awariom) — nie mają dziś retencji |
| MinIO, Keycloak, Identity: dostępność | 2 nieudane próby z rzędu | patrz niżej |
| Redis | dostępność | awaria degraduje realtime i **nie może** eskalować wyżej |

Dwa przypadki warte osobnego zdania:

- **Keycloak** nie kładzie zalogowanych natychmiast — działają do wygaśnięcia tokenu. Awaria
  objawia się jako „nikt nowy nie może się zalogować", zgłaszana z godzinnym opóźnieniem. Musi być
  sprawdzany bezpośrednio.
- **Identity** — `HttpPermissionProvider` cache'uje uprawnienia na 60 s i przy niedostępności
  Identity zwraca **pusty zbiór** (bezpieczna awaria: użytkownik dostaje 403 zamiast cichego
  ominięcia kontroli dostępu). Objaw dla użytkownika to lawina 403, nie 5xx — alert na udział
  odpowiedzi 403 wykrywa to szybciej niż cokolwiek innego.

#### f) Rozjazd baza ↔ MinIO

Referencja w bazie bez pliku w magazynie to realny scenariusz opisany
w [`media-storage.md` §4d](../guides/backend/media-storage.md). Okresowy audyt liczący rozjazd, z alertem na
wartość > 0 — bo bez niego wykryje go dopiero użytkownik klikający w zdjęcie sprzed pół roku.

#### g) Frontend

Błędy JS i nieudane ładowania remote'ów Native Federation — z tego samego powodu:
awaria po stronie przeglądarki nie zostawia śladu w logach backendu.

---

## 6. Korelacja — połączenie logu ze zgłoszeniem użytkownika

Materiał jest gotowy i nie wymaga wymyślania nowego identyfikatora: **`X-Request-Id` już płynie
z frontu** (`withRequestId`) i służy idempotencji komend
([`cqrs.md` §6](../guides/backend/cqrs.md#6-pipeline-komend)).

Trzy kroki, każdy w jednym miejscu:

1. `ExecutionContextMiddleware` / instrumentacja OTel — `X-Request-Id` jako baggage i pole
   w każdym logu żądania.
2. `ErpProblemDetailsHandler` — `traceId` w odpowiedzi błędu. Jest tam już słownik kodów błędów
   wspólny z `job_item.error_code`, więc miejsce jest naturalne.
3. Front pokazuje `traceId` w toaście błędu (`shared.errors.*`, patrz
   [`frontend/notifications.md`](../guides/frontend/notifications.md)).

Efekt: zgłoszenie brzmi „błąd o ID 4f2a…" zamiast „nie działa", a pełny ślad przez wszystkie
serwisy znajduje się w dwie sekundy. To pojedyncza zmiana o największym stosunku wartości do
kosztu w całym dokumencie.

---

## 7. Zapobieganie awariom

Wykrywanie skraca awarię. Ta sekcja ma sprawić, żeby się nie zdarzyła.

### 7.1 Degradacja zamiast padu

Zasada jest już w architekturze zapisana przy Redisie (awaria backplane'u degraduje realtime,
a nie kładzie autoryzacji całego ERP) i przy `HttpPermissionProvider` (pusty zbiór uprawnień
zamiast „wszystko wolno"). Brakuje jej w jednym miejscu:

**Wyłącznik na wołaniu Identity.** Timeout 5 s jest ustawiony, fail-closed działa — ale przy
padzie Identity **każde** żądanie w **każdym** module czeka te 5 s przed zwróceniem 403.
Przy kilkudziesięciu żądaniach na sekundę wyczerpuje to pulę wątków i zamienia awarię jednego
serwisu w awarię wszystkich. Do dopisania: wyłącznik (circuit breaker) na kliencie
`HttpPermissionProvider.IdentityHttpClientName` — po serii niepowodzeń odpowiadaj natychmiast
z ostatniego znanego stanu lub pustym zbiorem, bez czekania na timeout.

### 7.2 Limity

Pojedyncze żądanie nie może być w stanie położyć instancji:

- rate limiting na gatewayu (per IP i per użytkownik);
- twardy cap na liczbę celów operacji masowej — dziś ogranicza ją próg materializacji po stronie
  frontu ([`frontend/selection-scope.md`](../guides/frontend/selection-scope.md)), co jest zabezpieczeniem
  po niewłaściwej stronie granicy zaufania;
- cap na `pageSize` w zapytaniach listowych;
- limit rozmiaru wgrywanego pliku wymuszany przy wystawianiu biletu, nie dopiero przy rejestracji.

### 7.3 Retencja

`job`, `job_item` i `grant_audit` rosną monotonicznie. `IdempotencyCleanupService` jest gotowym wzorcem,
razem z jego uzasadnieniem `[ClusterSafe]` („jedno `ExecuteDelete` po wygasłych wierszach — druga
instancja usuwa zero wierszy"). Bez tego wykres wolnego miejsca stanie się z czasem twoim głównym
alertem, a `job` z milionem wierszy spowolni każde odpytanie historii zadań.

Osobno: osierocone `Draft` z [§5.2b](#b-zadanie-masowe-wiszące-i-zadania-nieudane) — ten sam
mechanizm, ten sam przebieg.

### 7.4 Poprawne wygaszanie procesu

Przy SIGTERM muszą **jawnie** zwolnić się: dzierżawy na advisory lockach Postgresa, `heartbeat_at`
przejętych przebiegów eksportu i wiersze `job` zajęte przez `SKIP LOCKED`. Bez tego po każdym
deployu jest kilkuminutowe okno, w którym praca startowa, eksport albo Relay są zablokowane przez
proces, którego już nie ma. Odzysk po progu to zabezpieczenie na pad — nie usprawiedliwienie dla
planowanego restartu.

### 7.5 Bramki przed wdrożeniem

- `Erp.ArchitectureTests` (w tym `BackgroundServiceTests` wymuszający `[ClusterSafe]` na każdej
  nowej usłudze tła) i `Erp.IntegrationTests` na Testcontainers — już są, wystarczy trzymać je
  w pipelinie jako blokujące;
- **odtworzenie backupu przećwiczone**, nie zapisane w checkliście
  ([runbook produkcyjny](production.md#backup-i-odtwarzanie));
- staging na tym samym `docker-compose.prod.yml` — różnica względem produkcji to wyłącznie
  wartości w plikach sekretów;
- test obciążeniowy na jednej reprezentatywnej operacji masowej przed pierwszym wyjściem: wąskie
  gardła w tej architekturze (pula połączeń, rozmiar chunka, przepustowość outboxu) ujawniają się
  wyłącznie pod obciążeniem.

---

## 8. Checklist

- [ ] `/health/live` i `/health/ready` rejestrowane w `AddErpApi`/`UseErpApi`, nie w `Program.cs`
- [ ] `/health/ready` sprawdza **tylko** Postgresa; zależności miękkie w `/health/deps`
- [ ] `ready` fałszywy przy SIGTERM, z odczekaniem na wypadnięcie z rotacji
- [ ] Zewnętrzna czujka **poza tym serwerem**, z powiadomieniem na telefon
- [ ] `traceId` w `ProblemDetails` i widoczny w toaście błędu na froncie
- [ ] Logi wszystkich serwisów w jednym miejscu, przeszukiwalne po `X-Request-Id`
- [ ] Alert: wiek najstarszej koperty outboxu > 2 min; `wolverine_dead_letters` > 0
- [ ] Alert: `job` w `Running` bez postępu > 30 min; `job` w `Failed`/`CompletedWithErrors`
- [ ] Alert: liczba żywych Relayów `!= 1` (w obie strony)
- [ ] Alert: wolne miejsce na dysku < 25% (Postgres i MinIO osobno)
- [ ] Alert: udział odpowiedzi 403 — wykrywa niedostępność Identity
- [ ] Wyłącznik na kliencie Identity
- [ ] Retencja dla `job`/`job_item`, `grant_audit` i osieroconych `Draft`
- [ ] Odtworzenie backupu przećwiczone na żywo

---

## 9. Zobacz też

- [Runbook wdrożenia produkcyjnego](production.md)
- [Wieloinstancyjność](../architecture/multi-instance.md) — dzierżawy, role Hub/Relay, `[ClusterSafe]`
- [Zdarzenia i outbox](../architecture/integration-events.md) — co dokładnie leży w schemacie `wolverine`
- [Operacje masowe](../guides/backend/bulk-commands.md) — `job`/`job_item`, `BulkCommandRunner`, stany
- [Eksporty i artefakty](../guides/backend/exports-artifacts.md) — `ExportRun`, `heartbeat_at`, odzysk
- [Magazyn plików](../guides/backend/media-storage.md) — [§4d rozjazd baza↔magazyn](../guides/backend/media-storage.md)
- [Tożsamość i uprawnienia](../architecture/security.md) — `HttpPermissionProvider`, cache i unieważnianie
