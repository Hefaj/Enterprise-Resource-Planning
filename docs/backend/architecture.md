# Architektura backendu

Backend to **mikroserwisy .NET 10**, po jednym na moduł biznesowy, każdy w **Clean Architecture**
z rozdziałem CQRS. Dane w **PostgreSQL** przez EF Core, komunikacja między serwisami zdarzeniami
przez **RabbitMQ** (Wolverine, transactional outbox). Frontend woła API swojego mikroserwisu
bezpośrednio — **nie ma warstwy BFF ani agregacji**.

Skrócona wersja jest wciągnięta do [`CLAUDE.md`](../../CLAUDE.md).

---

## 1. Stan wdrożenia

Dokumentacja opisuje docelową architekturę, ale nie wszystko jest już podpięte. Legenda używana
konsekwentnie we wszystkich dokumentach w tym katalogu:

| Znacznik | Znaczenie |
|---|---|
| ✅ | Działa i jest zweryfikowane end-to-end |
| 🟡 | Kod istnieje i się kompiluje, ale **nie jest podpięty** w żadnym `Program.cs` |
| 📐 | Projekt/decyzja, brak kodu |

| Obszar | Stan | Uwagi |
|---|---|---|
| Struktura projektów, granice warstw | ✅ | Wymuszone testem `Erp.ArchitectureTests` (5/5) |
| Persystencja EF + Postgres, migracje, seed | ✅ | [`persistence-ef.md`](./persistence-ef.md) |
| Strona odczytu (CQRS queries) | ✅ | Catalog: produkty, kategorie, drzewo, modele, gwarancje, multimedia |
| Strona zapisu (komendy, `IUnitOfWork`) | ✅ | `AddErpMessaging<TContext>()` wołane w `Program.cs` każdego modułu — rejestruje `IUnitOfWork` |
| Domain events → outbox → RabbitMQ | ✅ | [`events-outbox.md`](./events-outbox.md) |
| Operacje masowe (`job`/`job_item`, runner) | ✅ | [`bulk-commands.md`](./bulk-commands.md) — wykonują Catalog, Sales i Identity (w Identity **każda** mutacja `role/*`/`user/*` jest zadaniem); sterowanie: `job/cancel`, `job/retry-failed` |
| Walidacja wsadowa (pre-check reguł zbiorczych) | ✅ | [`batch-validation.md`](./batch-validation.md) — mechanizm wspólny, podpięty w Catalog (`ProductMustExistRule`, `ProductDuplicateRule`) i Identity (m.in. `RoleGraphCycleRule`) |
| SignalR (hub, grupy, reconnect, resync) | ✅ | [`realtime-signalr.md`](./realtime-signalr.md) — skalowanie poziome przez rozdział ról `Realtime:Role` i backplane Redis, patrz [§7](#7-wieloinstancyjność--założenia-zdjęte) |
| Eksporty i artefakty (`job.kind`, `ExportRun`, `ExportRunner`, MinIO) | ✅ | [`exports-artifacts.md`](./exports-artifacts.md) — zweryfikowane end-to-end w Catalogu |
| Multimedia wgrywane przez użytkownika (bilety, presigned PUT, endpoint zawartości) | ✅ | [`exports-artifacts.md` §9](./exports-artifacts.md#9-zawartość-wgrywana-przez-użytkownika--drugi-kubełek-druga-droga) — działa w Catalogu |
| Magazyn plików dla wielu modułów — kubełki per moduł, klucze MinIO per serwis, prefiks postojowy, usuwanie przez outbox, audytor rozjazdu | 🟡 | [`media-storage.md`](./media-storage.md) — wgrywanie, miniaturki i kasowanie plików potwierdzone na żywym MinIO; **bez przebiegu zostaje reguła lifecycle z dwoma wpisami na kubełku `transient`** ([§7](./media-storage.md#7-co-zostało-do-weryfikacji)) |
| Miniaturki i podglądy obrazów (SkiaSharp, generowanie przez outbox, endpoint wariantu, ponowne zlecenie) | ✅ | [`media-storage.md` §8](./media-storage.md#8-warianty-pochodne--miniaturki) — przebieg end-to-end na żywym MinIO; wariant gotowy 0,25 s po rejestracji zdjęcia 12 Mpx |
| Pipeline komend (logowanie, walidacja wejścia, jednostka pracy, idempotencja) | ✅ | [`cqrs.md` §6](./cqrs.md#6-pipeline-komend) — `ICommandDispatcher` zamiast szyny FastEndpoints; granicę transakcji przejmuje wywołujący przez `OwnTransaction()`. Klucze idempotencji w tabeli `idempotency_key` schematu modułu, karmione nagłówkiem `X-Request-Id` z frontu (`withRequestId`) |
| Mapowanie wyjątków na `ProblemDetails` | ✅ | `ErpProblemDetailsHandler` w `UseErpApi` — kod błędu w `type`/`errorCode` to ten sam słownik, co `job_item.error_code` |
| Sales jako pełny moduł biznesowy | 🟡 | Struktura i szablon zweryfikowane na agregacie `Customer`; brak realnej logiki biznesowej poza sprawdzianem |
| Uwierzytelnianie (Keycloak, JWT) | ✅ | [`identity-authz.md`](./identity-authz.md) §5 — Authorization Code + PKCE, fallback policy na każdym endpoincie |
| Autoryzacja — domena Identity (role, uprawnienia, katalog, JIT provisioning) | ✅ | [`identity-authz.md`](./identity-authz.md) §2-3, §7 |
| Egzekwowanie uprawnień w Catalog/Sales | ✅ | [`identity-authz.md`](./identity-authz.md) §4 — SLA odwołania ≤60s (TTL cache). Notification świadomie bez bramkowania uprawnieniem (własny feed, nie zasób uprzywilejowany), ale **zawężony do właściciela**: `searchJob`/`getJob` filtrują po `IExecutionContext.UserId` z claimu `sub`, nie po filtrze z żądania |
| Bramkowanie UI (front) | ✅ | [`identity-authz.md`](./identity-authz.md) §6 — `PermissionStore`, guardy, `*erpHasPermission`, filtr menu przeliczany na żywo, `/forbidden`, toast 403 |
| Audyt nadań, wygasające nadania, wymuszone wylogowanie | ✅ | [`identity-authz.md`](./identity-authz.md) §7 — `grant_audit` append-only, `ExpiredGrantCleanupService`, odwołanie sesji przez Keycloak Admin API |
| DMS — dokumenty i obiegi (silnik na tokenach, ACL per dokument, ingest, archiwizacja) | 📐 | [`dms-workflow.md`](./dms-workflow.md) + [`dms-pages.md`](../frontend/dms-pages.md) — projekt; front DMS to dziś atrapa, mikroserwisu `Dms` nie ma |
| Task Management — fazy 0–3 (mikroserwis, `Project`/`Issue`, komentarze i historia, **tablica z ręczną kolejnością kart**) + faza 3 (**pola niestandardowe na slotach**) | ✅ | [`task-management.md`](./task-management.md) §13 — faza 2: `board_card` z rankiem jako łańcuchem, `BoardSetCardPosition` liczący rank z sąsiadów w transakcji, rebalans `[ClusterSafe]`; faza 3: `FieldScheme` + sloty `num_/text_/date_/user_`, `custom_fields` (jsonb) jako źródło prawdy, `getProjectFieldProfile` wspólny dla kolumn, filtrów i whitelisty sortowania. Lista projektów i karta projektu z zakładką pól po stronie frontu |
| Task Management — faza 4: hierarchia i powiązania | 🟡 | [`task-management.md`](./task-management.md) §13 — `issue.parent_uuid`, `issue_link`, CTE wykrywające cykle, tryb drzewa i pasek powiązań; kod oraz testy jednostkowe są gotowe, weryfikacja pełnego przebiegu end-to-end pozostaje do wykonania |
| Task Management — zlecenia międzydziałowe, sprinty, edytor schematów | 📐 | [`task-management.md`](./task-management.md) fazy 5–7 + [`task-management-pages.md`](../frontend/task-management-pages.md) — projekt |
| Powiadomienia użytkownika (skrzynka międzymodułowa, `UserNotification`) | 📐 | [`user-notifications.md`](./user-notifications.md) — drugi agregat w istniejącym `Notification`; dziś dzwonek karmi się wyłącznie repliką zadań |

---

## 2. Struktura katalogów

```
backend/
├── Directory.Build.props           # net10.0, nullable, warnings-as-errors, CPM
├── Directory.Packages.props        # wersje WSZYSTKICH pakietów — jedyne miejsce
├── .editorconfig                   # migracje EF oznaczone jako kod generowany
├── docker-compose.yml              # postgres:17, rabbitmq:4-management
│
├── building-blocks/                # część wspólna dla wszystkich mikroserwisów
│   ├── Erp.BuildingBlocks.Domain/         # Entity, AggregateRoot, ValueObject, DomainException
│   ├── Erp.BuildingBlocks.Contracts/      # kontrakty integracyjne (publiczne, wersjonowane)
│   ├── Erp.BuildingBlocks.Application/    # abstrakcje: IClock, IUnitOfWork, IExecutionContext…
│   ├── Erp.BuildingBlocks.Persistence/    # ErpDbContext, AggregateChangeScanner, ErpUnitOfWork
│   ├── Erp.BuildingBlocks.Messaging/      # Wolverine: RabbitMQ + outbox na Postgresie
│   ├── Erp.BuildingBlocks.Jobs/           # Job, JobItem, BulkCommandRunner
│   ├── Erp.BuildingBlocks.Validation/     # IBatchRule, ValidationChain (walidacja wsadowa)
│   └── Erp.BuildingBlocks.Api/            # bootstrap FastEndpoints/CORS, auth, kontrakty żądań
│
├── modules/
│   ├── Catalog/                    # wzorcowy moduł — na nim modeluj kolejne
│   │   ├── Catalog.Domain/         # agregaty, reguły, zdarzenia domenowe
│   │   ├── Catalog.Application/    # komendy, zapytania, DTO, abstrakcje repozytoriów
│   │   ├── Catalog.Infrastructure/ # DbContext, konfiguracje EF, migracje, repozytoria, seed
│   │   └── Catalog.Api/            # endpointy FastEndpoints, Program.cs
│   ├── Identity/                   # role, uprawnienia, audyt nadań (schemat `identity`)
│   ├── Notification/               # replika zadań + hub SignalR (schemat `notification`)
│   └── Sales/                      # szkielet — jeden agregat `Customer` jako sprawdzian szablonu
│
├── keycloak/                       # realm-erp.json (IdP, nie mikroserwis)
│
└── tests/
    ├── Erp.ArchitectureTests/      # granice warstw — odpowiednik ESLinta z frontendu
    ├── Catalog.Tests/
    └── Identity.Tests/
```

Nazewnictwo `backend/modules/<Moduł>/` mapuje się 1:1 na `frontend/libs/modules/<moduł>/`
i na mapę portów z `CLAUDE.md`.

---

## 3. Cztery warstwy modułu

```
Api ──────► Application ──────► Domain
 │               ▲
 └──► Infrastructure ──┘        (implementuje interfejsy z Application)
```

| Warstwa | Rola | Może referencować |
|---|---|---|
| `Domain` | Agregaty, reguły biznesowe, zdarzenia domenowe. **Zero** EF, ASP.NET, Wolverine'a. | `BuildingBlocks.Domain` |
| `Application` | Komendy, handlery, zapytania (interfejsy), DTO, abstrakcje repozytoriów. | `Domain`, `BuildingBlocks.{Application,Api}` |
| `Infrastructure` | `DbContext`, konfiguracje EF, migracje, repozytoria, implementacje zapytań, consumery, seed. | `Domain`, `Application`, `BuildingBlocks.{Persistence,Messaging,Jobs}` |
| `Api` | Endpointy FastEndpoints, `Program.cs` (kompozycja kontenera DI). | `Application`, `Infrastructure`, `BuildingBlocks.Api` |

`Api` referencuje `Infrastructure` **wyłącznie po to, żeby złożyć kontener** w `Program.cs`.
Kod endpointów sięga do abstrakcji z `Application` — nigdy do EF bezpośrednio.

### Dlaczego to jest wymuszone testem, a nie konwencją

`Erp.ArchitectureTests` (NetArchTest) sprawdza m.in., że `Domain` i `Application` nie zależą od
EF Core, ASP.NET, Wolverine'a i Npgsql. To świadomy odpowiednik `@nx/enforce-module-boundaries`
z frontendu: złamanie granicy ma wywalić build, a nie zostać wyłapane (albo i nie) w code review.
Reguła zapisana wyłącznie w dokumencie jest regułą, która prędzej czy później przestaje obowiązywać.

```bash
dotnet test backend/tests/Erp.ArchitectureTests/Erp.ArchitectureTests.csproj
```

---

## 4. Decyzje technologiczne i ich powody

| Decyzja | Powód |
|---|---|
| **Wolverine** (nie MassTransit) | MassTransit v9 jest komercyjny (min. $400/mies.), a v8 (Apache 2.0) wchodzi w EOL z końcem 2026. Wolverine jest na licencji MIT i wnosi durable outbox zintegrowany z transakcją EF Core. |
| **FastEndpoints Command Bus** (nie MediatR) | MediatR od v13 jest płatny. FastEndpoints był już w projekcie, ma pipeline'y i nie wymaga nowej zależności. |
| **Klasyczne CQRS**, bez event sourcingu | Stan bieżący + zdarzenia domenowe wystarczają dla ERP. Event sourcing dokłada wersjonowanie zdarzeń i utrudnia zapytania ad-hoc bez korzyści, której tu potrzeba. |
| **Jedna baza, schemat per moduł** | Prostsze lokalnie niż baza per serwis; rozdzielenie to potem zmiana connection stringów. Granicy pilnuje osobny `DbContext` per moduł. |
| **UUID v7 jako klucz główny** | Sekwencyjny po czasie, więc wstawki nie fragmentują indeksu B-tree jak losowy v4. Identyfikator jest częścią kontraktu z frontendem (orkiestratory adresują agregaty po `uuid`). |
| **`xmin` jako token współbieżności** | Systemowa kolumna Postgresa — kontrola współbieżności bez dodatkowej kolumny w każdej tabeli. |

---

## 5. Uruchomienie lokalne

```bash
podman compose -f backend/docker-compose.yml up -d
```

Postgres na `5432` (`erp`/`erp`/`erp`), RabbitMQ na `5672`, management UI na
[localhost:15672](http://localhost:15672).

```bash
dotnet run --project backend/modules/Catalog/Catalog.Api
```

Przy starcie w `Development` moduł stosuje migracje i zasila bazę danymi przykładowymi
(sterowane przez `Database:MigrateOnStartup` i sekcję `Seed` — patrz
[`persistence-ef.md`](./persistence-ef.md)).

| Serwis | Port HTTP | Schemat w bazie |
|---|---|---|
| Catalog | 5149 | `catalog` |
| Notification | 5250 | `notification` |
| Sales | 5269 | `sales` |
| Identity | 5280 | `identity` |
| Keycloak (IdP, nie mikroserwis) | 8080 | `keycloak` |

Adresy bazowe dla frontendu konfiguruje
[`remote-api.providers.ts`](../../frontend/apps/client/src/app/remote-api.providers.ts).

---

## 6. Kontrakt z frontendem

Kontrakt HTTP jest **zamrożony**: klienty TypeScript są generowane NSwagiem
(`frontend/libs/modules/*/data-access/nswag.json`), a orkiestratory budują na nich ViewModele.
Zmiana nazwy typu, pola albo ścieżki to zmiana łamiąca.

Dwie rzeczy, które łatwo złamać nieumyślnie:

1. **Nazwa klasy komendy trafia do nazwy typu w kliencie.** `ProductSetPriceCommand` generuje
   `BatchCommandOfProductSetPriceCommandAndSearchProductRequest`, importowane wprost przez
   `catalog-product.orchestrator.ts`. Przemianowanie klasy w C# psuje frontend, mimo że sam
   JSON się nie zmienia.
2. **Nazwa klasy endpointu trafia do nazwy metody klienta.** `UseErpApi` obcina sufiks `Endpoint`,
   więc `SearchProductEndpoint` → `searchProduct`.

Weryfikacja zgodności bez regenerowania klienta:

```bash
curl -s http://localhost:5149/openapi/v1.json > /tmp/openapi.json
```

…a następnie porównanie zestawu typów i pól z `api-client.ts`. Przy migracji Catalogu na Postgresa
to porównanie (29 typów, 14 ścieżek) wychwyciło rozjazd, którego testy jednostkowe by nie złapały.

---

## 7. Wieloinstancyjność — założenia zdjęte

Backend **nie zakłada już jednej instancji serwisu**. Ten rozdział był wcześniej listą miejsc,
które to założenie niosły; teraz opisuje, czym każde z nich zostało zastąpione. Pełny plan —
kolejność faz, odrzucone warianty i kryteria akceptacji — leży w
[`multi-instance.md`](./multi-instance.md).

Zasada, która przeszła przez całość: **Redis został w dokładnie jednym miejscu.** Backplane
SignalR jest jedyną rzeczą, której Postgres nie potrafi zrobić. Wszystko inne — dzierżawy,
licznik sekwencji, wybór zadania, koordynacja startu — idzie przez Postgresa, który już jest
transakcyjnym źródłem prawdy; zewnętrzny lock obok `job.status` byłby drugim źródłem prawdy,
zdolnym się z nim rozjechać.

| Mechanizm | Czym rozwiązany | Gdzie |
|---|---|---|
| Rozgłaszanie SignalR | Backplane Redis, włączany warunkowo przez `Realtime:Redis` | [`Program.cs`](../../backend/modules/Notification/Notification.Api/Program.cs) |
| Koalescencja, próg inwalidacji, sekwencja | Rozdział ról `Realtime:Role` = `Hub` \| `Relay` \| `Both` — decyduje **jeden** przekaźnik, wysyła N hubów | [`RealtimeBroadcastOptions`](../../backend/modules/Notification/Notification.Api/Realtime/RealtimeBroadcastOptions.cs) |
| Licznik sekwencji | Tabela `notification.signature_sequence`, atomowy `INSERT … ON CONFLICT DO UPDATE … RETURNING` | [`SignatureSequence`](../../backend/modules/Notification/Notification.Infrastructure/Realtime/SignatureSequence.cs) |
| Wybór zadania masowego | `FOR UPDATE SKIP LOCKED` na wierszu `job`, w **tej samej transakcji** co wykonanie chunka | [`JobQueueLock`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/JobQueueLock.cs) |
| Wybór przebiegu eksportu | Krótka transakcja przejęcia + `export_run.heartbeat_at` i reguła odzysku | [`ExportRunner`](../../backend/modules/Catalog/Catalog.Infrastructure/Jobs/ExportRunner.cs) |
| Usługi cykliczne (audyt mediów, wygasłe nadania) | Dzierżawa na advisory locku Postgresa — brak dzierżawy oznacza pominięty przebieg | [`IExclusiveLease`](../../backend/building-blocks/Erp.BuildingBlocks.Persistence/Concurrency/IExclusiveLease.cs) |
| Start procesu (migracje, seedy, katalog uprawnień) | Ta sama dzierżawa w wariancie **blokującym** — instancja B czeka i zastaje bazę gotową | [`ErpDatabaseMigrator`](../../backend/building-blocks/Erp.BuildingBlocks.Persistence/ErpDatabaseMigrator.cs) |
| Cache uprawnień i wymuszone wylogowanie | Broadcast `PermissionsInvalidated` osobną wymianą `erp.broadcast`, kolejka **per instancja** | [`PermissionsInvalidated`](../../backend/building-blocks/Erp.BuildingBlocks.Application/Messaging/PermissionsInvalidated.cs) |

### Trzy rzeczy, które warto z tego zapamiętać

**Fanout ≠ broadcast.** Wymiana `erp.events` jest fanoutowa, ale wiąże **jedną nazwaną kolejkę
per serwis** (`Messaging:ListenQueueName`), więc N instancji tego samego serwisu to *competing
consumers*: komunikat dostaje jedna z nich. To jest właściwe dla pracy do wykonania i błędne dla
unieważnienia cache'u, które musi dotrzeć do wszystkich. Stąd osobna wymiana `erp.broadcast`
i nietrwała, auto-delete kolejka per instancja — jedyne miejsce w systemie, gdzie chcemy
prawdziwego rozgłoszenia zamiast rozdziału pracy.

**Próg inwalidacji psuł się odwrotnie, niż podpowiada intuicja.** `InvalidationThreshold` liczy
identyfikatory zebrane w oknie przez *jedną* instancję. Bulk na 50 tys. produktów rozłożony na
cztery instancje to cztery bufory po ~12,5 tys. — każdy poniżej progu, więc zamiast jednego
`ReceiveInvalidation(.., "all")` przez WebSocket poszedłby komplet uuid-ów: zabezpieczenie
znikałoby dokładnie w scenariuszu, dla którego powstało. Backplane sam z siebie by tego nie
naprawił. Naprawia to rozdział ról: decyzję podejmuje jeden przekaźnik, więc próg znów widzi
cały strumień.

**Kolizja runnerów nie wyglądała jak problem ze współbieżnością.** `xmin` wyłapywał konflikt
dopiero na `SaveChanges`, co unieważniało transakcję całego chunka i spychało go w ścieżkę
izolacji „element po elemencie"
([`bulk-commands.md`](./bulk-commands.md#3-wykonanie--bulkcommandrunner)) — w logach seria
`concurrency_conflict` i drastyczny spadek przepustowości, czyli obraz awarii bazy, a nie dwóch
runnerów robiących tę samą pracę.

### Reguła na przyszłość

Każda nowa usługa tła musi zadeklarować, co robi przy wielu instancjach — atrybutem
[`[ClusterSafe(powód)]`](../../backend/building-blocks/Erp.BuildingBlocks.Application/Abstractions/ClusterSafeAttribute.cs).
Wymusza to test architektoniczny `BackgroundServiceTests`, więc pominięcie deklaracji wywala
build, a nie wychodzi po wdrożeniu drugiej instancji. Odpowiedź „nic złego się nie stanie" jest
w porządku; nieodpowiedzenie nie jest.

### Co było gotowe od początku

Te miejsca nie wymagały zmiany i to nie przypadek — w każdym świadomie wybrano trwałość zamiast
pamięci procesu:

- **Outbox i RabbitMQ** — koperta zapisuje się w transakcji danych ([`events-outbox.md`](./events-outbox.md)).
- **`job`/`job_item` w bazie** — zadanie przeżywa restart; brakowało wyłącznie wyłączności przy
  *wyborze*, nie trwałości.
- **Klucze idempotencji** — `EfIdempotencyStore` trzyma je w tabeli schematu modułu i zatwierdza
  w jednej transakcji ze skutkiem komendy.
- **Strona odczytu** — bezstanowa, `AsNoTracking`, projekcja wprost do DTO.
- **Cache frontendowy** — `IdentityMapStore` żyje w przeglądarce i jest inwalidowany zdarzeniami
  ([`orchestrators.md`](../frontend/orchestrators.md)).

### Dowody

Kryteria akceptacji nie są listą życzeń — mają testy w
[`backend/tests/Erp.IntegrationTests`](../../backend/tests/Erp.IntegrationTests), chodzące na
Testcontainers (Postgres i RabbitMQ z obrazów, bez zależności od infrastruktury deweloperskiej).
Pełna tabela: [`multi-instance.md` §10](./multi-instance.md#10-kryteria-akceptacji).

Warto odnotować, że weryfikacja **nie była formalnością**: wykryła dwie usterki, których przegląd
kodu nie złapał, obie po stronie broadcastu unieważnień i obie ciche. Opis w
[`multi-instance.md` §11](./multi-instance.md#11-odstępstwa-od-planu).

### Co zostaje otwarte

- **Rozgłaszanie SignalR przez backplane** nie ma testu automatycznego — wymagałby trzech hostów
  ASP.NET, Redisa i uwierzytelnionych klientów WebSocket, czyli kosztu nieproporcjonalnego do
  tego, że sprawdzałby w istocie bibliotekę Microsoftu. Sprawdzone <b>ręcznie</b> profilem
  [`docker-compose.multi.yml`](../../backend/docker-compose.multi.yml): dwaj klienci na dwóch
  różnych hubach dostają zmianę zleconą przez load balancer
  ([`multi-instance.md` §8.3](./multi-instance.md#83-profil-wieloinstancyjny--co-wyszło-przy-pierwszym-uruchomieniu)).
- **`Messaging:PrecompiledHandlers`** jest gotowe i wyłączone domyślnie — kod handlerów trzeba
  regenerować przy każdej zmianie ich kształtu, więc włączenie flagi to decyzja wdrożenia
  ([`multi-instance.md` §8.2](./multi-instance.md#82-kod-handlerów-generowany-z-wyprzedzeniem)).

---

## 8. Zobacz też

- [Persystencja — EF Core i Postgres](./persistence-ef.md)
- [CQRS — komendy i zapytania](./cqrs.md)
- [Zdarzenia domenowe, outbox i integracja](./events-outbox.md)
- [Operacje masowe](./bulk-commands.md), [Walidacja wsadowa](./batch-validation.md)
- [Synchronizacja w czasie rzeczywistym (SignalR)](./realtime-signalr.md)
- [Tożsamość i uprawnienia](./identity-authz.md)
- [Eksporty i artefakty](./exports-artifacts.md), [Magazyn plików](./media-storage.md)
- [Nowy mikroserwis — przepis](./new-microservice.md)
- Frontend: [architektura](../frontend/architecture.md), [orkiestratory](../frontend/orchestrators.md)
