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
| SignalR (hub, grupy, reconnect, resync) | ✅ | [`realtime-signalr.md`](./realtime-signalr.md) — jedna instancja Notification; skalowanie poziome wymaga zmian z [§7](#7-założenia-jednoinstancyjne) |
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

## 7. Założenia jednoinstancyjne

Backend zakłada dziś **jedną instancję każdego serwisu**. Nie jest to przeoczenie: trwałość jest
w tych miejscach, gdzie utrata danych bolałaby (outbox, `job`/`job_item`), a stan czysto
efemeryczny świadomie został w pamięci procesu, bo w jednej instancji nic nie kupuje za to
dodatkowa infrastruktura.

Lista jest w jednym miejscu, a nie rozsiana po dokumentach, z jednego powodu: przy skalowaniu
poziomym te mechanizmy trzeba ruszyć **razem**. Włączenie samego backplane'u SignalR wygląda
jak gotowość, a zostawia trzy pozostałe punkty ciche i zepsute.

| Mechanizm | Gdzie | Co się psuje przy >1 instancji |
|---|---|---|
| Rozgłaszanie SignalR | [`SyncHub`](../../backend/modules/Notification/Notification.Api/Hubs/SyncHub.cs), grupy `agg:`/`user:` | Klient podłączony do instancji A nie dostaje wiadomości rozgłoszonej przez B. Cichy, nieaktualny UI — bez błędu i bez logu. |
| Licznik sekwencji | [`SignatureSequenceTracker`](../../backend/modules/Notification/Notification.Api/Realtime/SignatureSequenceTracker.cs) — `ConcurrentDictionary` w pamięci | Każda instancja liczy własną sekwencję. Reconnect na inną instancję daje rozjazd `lastSeenSequence` bez luki (resync fałszywie dodatni) albo zgodność mimo luki (resync pominięty — gorszy przypadek). |
| Koalescencja i próg inwalidacji | [`RealtimeBroadcaster`](../../backend/modules/Notification/Notification.Api/Realtime/RealtimeBroadcaster.cs) — bufor per sygnatura w pamięci singletona | Patrz niżej — psuje się inaczej, niż podpowiada intuicja. |
| Wybór zadania masowego | [`BulkCommandRunner.ProcessNextChunkAsync`](../../backend/building-blocks/Erp.BuildingBlocks.Jobs/BulkCommandRunner.cs) | Zapytanie o najstarsze `Pending`/`Running` nie zakłada żadnego lease'u ani locka: dwa runnery biorą **to samo** zadanie i **te same** `job_item`-y. |
| Wybór przebiegu eksportu | [`ExportRunner.ProcessNextRunAsync`](../../backend/modules/Catalog/Catalog.Infrastructure/Jobs/ExportRunner.cs) | Ten sam brak lease'u co wyżej, ale skutek jest gorszy: dwa runnery wygenerowałyby **dwa artefakty** dla jednego przebiegu, z których jeden zostałby osierocony w magazynie — bez wiersza, który by o nim wiedział, więc i bez szans na posprzątanie inaczej niż regułą lifecycle. |
| Audytor rozjazdu magazynu | [`MediaReconciliationService`](../../backend/modules/Catalog/Catalog.Infrastructure/Jobs/MediaReconciliationService.cs) — [`media-storage.md` §4d](./media-storage.md#4d-rozjazd-baza--kubełek) | Ten sam brak lease'u co u runnerów: dwie instancje wylistowałyby ten sam kubełek i **skasowały te same obiekty**. Skutek jest łagodzony domyślną konfiguracją (`Enabled=false`, `DeleteOrphans=false`), ale po włączeniu kasowania to jest zwykły wyścig o usunięcie danych. |
| Cache uprawnień | [`HttpPermissionProvider`](../../backend/building-blocks/Erp.BuildingBlocks.Api/Auth/PermissionProvider.cs) — `IMemoryCache` per proces, TTL 60s, w KAŻDYM mikroserwisie-konsumencie (Catalog, Sales) | Każda instancja ma własny cache z własnym zegarem TTL — odebranie uprawnienia dogania się do 60s NIEZALEŻNIE na każdej instancji, nie synchronicznie. Przy N instancjach okno „stara instancja jeszcze przepuszcza" może się wydłużyć, jeśli TTL-y akurat się rozjadą (nigdy nie skróci się poniżej 60s, może się wydłużyć do niemal 2×60s w pesymistycznym przypadku). Backplane (Redis) ujednoliciłby to — patrz [`identity-authz.md`](./identity-authz.md) §9. |
| Wymuszone wylogowanie | [`IPermissionProvider.InvalidateAsync`](../../backend/building-blocks/Erp.BuildingBlocks.Api/Auth/PermissionProvider.cs) wołane z `UserForceLogoutCommandHandler` w Identity | Czyści cache TYLKO w procesie, który obsłużył żądanie odwołania sesji. Przy >1 instancji Catalogu/Sales inwalidacja nie dotrze do pozostałych — te nadal przepuszczają do naturalnego TTL=60s. Odwołanie sesji Keycloak (Admin API) działa niezależnie od liczby instancji (stan po stronie IdP), ale już wydany access token JWT pozostaje ważny do naturalnego wygaśnięcia — nie ma introspekcji tokenu. Backplane rozwiązałby cache tak samo jak wiersz wyżej. |

### Dlaczego próg inwalidacji psuje się odwrotnie, niż się wydaje

Wymiana `erp.events` jest typu **fanout**, ale wiąże **jedną nazwaną kolejkę per serwis**
(`Messaging:ListenQueueName`, np. `notification.events` — patrz
[`events-outbox.md`](./events-outbox.md)). Dwie instancje Notification z tą samą konfiguracją
są więc **competing consumers na jednej kolejce**, a nie dwoma niezależnymi odbiorcami: każda
widzi ułamek strumienia `AggregateChanged`.

Skutki są dwa i tylko pierwszy jest oczywisty:

1. Klient dostaje do N wiadomości na okno koalescencji zamiast jednej. Nieprzyjemne, ale
   nieszkodliwe — front traktuje aktualizacje idempotentnie.
2. **`InvalidationThreshold` przestaje trafiać.** Próg liczy identyfikatory zebrane w oknie przez
   *jedną* instancję. Bulk na 50 tys. produktów rozłożony na cztery instancje to cztery bufory
   po ~12,5 tys. — każdy poniżej progu, więc zamiast jednego `ReceiveInvalidation(.., "all")`
   przez WebSocket idzie komplet uuid-ów. Zabezpieczenie znika dokładnie w tym scenariuszu,
   dla którego powstało.

To jest powód, dla którego backplane sam z siebie nie wystarcza: rozwiąże punkt 1, a punkt 2
zostawi nietknięty. Próg i koalescencja muszą stać się wspólne dla wszystkich instancji, tak samo
jak licznik sekwencji.

### Kierunki naprawy

Poniższa tabela to skrót. Pełny plan zdjęcia tych założeń — fazy, kolejność, kryteria
akceptacji i rewizja decyzji o liczniku sekwencji — leży w
[`multi-instance.md`](./multi-instance.md).

| Obszar | Kierunek | Uwaga |
|---|---|---|
| Rozgłaszanie + licznik sekwencji | Backplane Redis + atomowy licznik (`INCR` per sygnatura) | **Jedyne miejsce w systemie, gdzie Redis jest właściwą odpowiedzią, a nie wygodą** — SignalR nie ma backplane'u na Postgresie. Jedno wdrożenie zamyka oba punkty. |
| Koalescencja i próg | Do rozstrzygnięcia razem z backplane'em | Albo wspólny bufor, albo pojedynczy dedykowany konsument `AggregateChanged`, który rozgłasza przez backplane. Druga opcja zachowuje dzisiejszą semantykę progu bez współdzielenia stanu. |
| Wybór zadania | `SELECT … FOR UPDATE SKIP LOCKED` przy pobieraniu `job_item`-ów | **Nie lock w Redisie** — dane zadania są już transakcyjne w Postgresie, a zewnętrzny lock byłby drugim źródłem prawdy obok `job.status`, zdolnym się z nim rozjechać. |

Dzisiejszy objaw kolizji runnerów warto znać, bo nie wygląda jak problem ze współbieżnością:
`xmin` wyłapuje konflikt dopiero na `SaveChanges`, co unieważnia transakcję całego chunka
i spycha go w ścieżkę izolacji „element po elemencie"
([`bulk-commands.md`](./bulk-commands.md#3-wykonanie--bulkcommandrunner)). W logach wygląda to
jak seria `concurrency_conflict` i drastyczny spadek przepustowości — czyli jak awaria bazy,
a nie jak dwa runnery robiące tę samą pracę.

### Czego ruszać nie trzeba

Zapisy i komunikacja między serwisami są na wiele instancji gotowe i to nie jest przypadek —
w każdym z tych miejsc świadomie wybrano trwałość zamiast pamięci procesu:

- **Outbox i RabbitMQ** — koperta zapisuje się w transakcji danych, kolejka rozdziela pracę
  między konsumentów ([`events-outbox.md`](./events-outbox.md)).
- **`job`/`job_item` w bazie** — zadanie przeżywa restart i wznawia się od pierwszego
  nieprzetworzonego elementu; brakuje wyłącznie lease'u przy **wyborze**, nie trwałości.
- **Strona odczytu** — bezstanowa, `AsNoTracking`, projekcja wprost do DTO.
- **Cache frontendowy** — `IdentityMapStore` żyje w przeglądarce i jest inwalidowany zdarzeniami,
  więc nie zależy od tego, ile instancji stoi po drugiej stronie
  ([`orchestrators.md`](../frontend/orchestrators.md)).

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
