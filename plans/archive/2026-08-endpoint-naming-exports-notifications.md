# Plan realizacji — nazewnictwo endpointów, eksporty, powiadomienia

> **Status:** completed (25.08.2026)
>
> **Zarchiwizowany plan historyczny — nie jest źródłem aktualnych reguł technicznych.**
> Dokumentacja docelowa (zostaje): [`docs/guides/backend/endpoint-naming.md`](../../docs/guides/backend/endpoint-naming.md),
> [`docs/guides/backend/exports-artifacts.md`](../../docs/guides/backend/exports-artifacts.md),
> [`docs/guides/frontend/notifications.md`](../../docs/guides/frontend/notifications.md).

---

## Podsumowanie

| Etap | Zakres | Zależy od | Zmiana łamiąca | Stan |
|---|---|---|---|---|
| 1 | Nazewnictwo komend, endpointów i tras | — | **tak** (NSwag) | ✅ zrobione |
| 2 | Infrastruktura artefaktów (MinIO, `job.kind`, `ExportRun`) | — | nie | ✅ zrobione |
| 3 | Kontrakt wyniku do frontu (`resultRef`) | 2 | tak (dodanie pól) | ✅ zrobione |
| 4 | `ErpToastService` na froncie | — | nie | ✅ zrobione |
| 5 | Poprawki zastane | — | 5.1 tak (kontrakt) | ✅ zrobione |

Etap 1 okazał się **mniejszy, niż wyglądał**: z 15 komend w systemie tylko 6 wymagało
przemianowania. Reszta już spełniała konwencję.

Etap 5.1 wyszedł **szerszy**, niż zakładał plan — patrz opis w sekcji 5.1.

> **Wszystkie pięć etapów wdrożone, cała weryfikacja domknięta** (25.08.2026) — łącznie
> z autoryzowaną ścieżką HTTP eksportu i ręcznym przebiegiem operacji masowej w Identity;
> szczegóły w sekcji „Weryfikacja".
>
> **Ten plik nie ma już nic otwartego — można go usunąć.** Wiedza, która ma zostać, mieszka
> w `docs/guides/backend/endpoint-naming.md`, `docs/guides/backend/exports-artifacts.md`
> i `docs/guides/frontend/notifications.md`.

---

## Etap 1 — Nazewnictwo

### 1.1 Przemianowania komend (6)

| Dziś | Docelowo | Moduł | Powód |
|---|---|---|---|
| `SetCustomerNameCommand` | `CustomerSetNameCommand` | Sales | czasownik przed agregatem |
| `UserAssignRoleCommand` | `UserAddRoleCommand` | Identity | `Assign` → `Add` |
| `UserRevokeRoleCommand` | `UserRemoveRoleCommand` | Identity | `Revoke` → `Remove` |
| `UserGrantPermissionCommand` | `UserAddPermissionCommand` | Identity | `Grant` → `Add` |
| `UserRevokePermissionCommand` | `UserRemovePermissionCommand` | Identity | `Revoke` → `Remove` |
| `UserForceLogoutCommand` | `UserExecForceLogoutCommand` | Identity | operacja procesowa |

Bez zmian (już zgodne): `ProductSetName`, `ProductSetPrice`, `ProductSetClassification`,
`RoleCreate`, `RoleAddMember`, `RoleAddPermission`, `RoleRemoveMember`, `RoleRemovePermission`.

- [x] Przemianuj klasy komend i ich handlery (`*CommandHandler`)
- [x] Przemianuj metody agregatu, jeśli się rozjechały (`user.AssignRole` → `user.AddRole` itd.)
- [x] `SamplePlainCommand` w `backend/tests/Erp.ArchitectureTests/ModuleRegistrationTests.cs` —
      albo przemianuj, albo wyłącz zestawy testowe ze skanu w 1.5

> **Uwaga migracyjna.** `BulkCommandRunner` odnajduje egzekutor po `job.CommandType`, czyli po
> **stringu zapisanym w bazie**. Zadania `Pending`/`Running` założone przed przemianowaniem nie
> znajdą swojego handlera. W dev wystarczy wyczyścić `job`/`job_item`; gdyby kiedyś doszło do tego
> na danych, których nie wolno stracić — potrzebna migracja `UPDATE job SET command_type = …`.

### 1.2 Przemianowania endpointów (6)

Idą 1:1 za komendami: `UserAssignRoleMultipleCommandEndpoint` → `UserAddRoleMultipleCommandEndpoint` itd.

- [x] Przemianuj klasy w `Identity.Api/Users/Command/` (5 plików) i `Sales.Api/Customers/Command/` (1)
- [x] Zaktualizuj trasy: `batch-assign-role` → `batch-add-role`, `batch-revoke-role` →
      `batch-remove-role`, `batch-grant-permission` → `batch-add-permission`,
      `batch-revoke-permission` → `batch-remove-permission`, `batch-force-logout` →
      `batch-exec-force-logout`

### 1.3 Poprawka podwójnego prefiksu trasy (4)

Catalog i Sales powtarzają nazwę grupy w trasie — wygenerowany klient woła
`/product/product/batch-set-price`.

- [x] `Catalog.Api/Products/Command/ProductSetPriceMultipleCommandEndpoint.cs` —
      `Post("product/batch-set-price")` → `Post("batch-set-price")`
- [x] to samo w `ProductSetNameMultipleCommandEndpoint.cs` i `ProductSetClassificationMultipleCommandEndpoint.cs`
- [x] `Sales.Api/Customers/Command/CustomerSetNameMultipleCommandEndpoint.cs` —
      `Post("customer/batch-set-name")` → `Post("batch-set-name")`

### 1.4 `CreateBatchEndpointBase`

- [x] Nowa klasa w `Erp.BuildingBlocks.Api/Contracts/` — odrzuca `TargetFilter` i `TargetUuids`
      błędem 400 zamiast po cichu zakładać zadanie z zerem celów
- [x] `RoleCreateMultipleCommandEndpoint` dziedziczy po niej; znika obejście z
      `Task.FromResult(Enumerable.Empty<Guid>())`

### 1.5 Test architektoniczny

W `backend/tests/Erp.ArchitectureTests/`:

- [x] Każda implementacja `ICommand<>` pasuje do
      `^[A-Z][A-Za-z]*(Create|Set|Add|Remove|Exec)[A-Za-z]*Command$`
- [x] Prefiks agregatu zgadza się z folderem, w którym komenda leży
- [x] Każda komenda ma dokładnie jeden endpoint wsadowy i odwrotnie
- [x] Trasa endpointu nie zaczyna się od nazwy swojej grupy (łapie regresję z 1.3)

### 1.6 Regeneracja klienta i front

**Kolejność jest istotna** — rozjazd między krokami kompiluje się na backendzie i wywala dopiero
w przeglądarce.

- [x] Uruchom serwisy i zregeneruj klientów NSwagiem
      (`frontend/libs/modules/*/data-access/nswag.json`) — zrobione przy etapie 3.
- [x] Popraw wywołania w `identity/data-access/src/lib/orchestrators/user/user.orchestrator.ts`
- [x] Popraw importy typów `BatchCommandOf*` tamże
- [x] Zaktualizuj `IDENTITY_JOB_COMMAND_KEYS` w `identity/util/src/lib/job-command-keys.ts`
      i odpowiadające klucze w `libs/shared/ui/src/lib/translation/` (`pl-PL.json`, `en-US.json`),
      potem `pnpm translate:keys`
- [x] Opcjonalnie, dla spójności: nazwy folderów modali
      (`users/modal/user-assign-role/` → `user-add-role/`, `user-grant-permission/` →
      `user-add-permission/`) plus `entry.modals.ts`

---

## Etap 2 — Infrastruktura artefaktów

### 2.1 MinIO

- [x] Usługa `minio` w `backend/docker-compose.yml` (obok postgres/rabbitmq/keycloak).
      **Porty 9100/9101, nie 9000/9001** — 9000 był na maszynie zajęty przez inny proces,
      a kolizja objawia się wyłącznie tym, że kontener nie wstaje. Wewnątrz sieci compose
      MinIO nadal słucha na 9000; przesunięte jest tylko mapowanie na hosta.
- [x] Bucket zakładany przy starcie modułu (idempotentnie), nie ręcznie

### 2.2 `IArtifactStore`

- [x] Interfejs w `Erp.BuildingBlocks.Application/Abstractions/` — sygnatura w
      [`exports-artifacts.md` §5](../../docs/guides/backend/exports-artifacts.md#5-magazyn-artefaktów--minio)
- [x] Implementacja w **nowym projekcie `Erp.BuildingBlocks.Artifacts`** — projektu
      `Erp.BuildingBlocks.Infrastructure` nie ma, a wciskanie klienta S3 do `.Persistence`
      (EF) byłoby nadużyciem. Rejestracja jawna przez `AddErpArtifacts`, nie przez konwencję:
      klient MinIO jest singletonem z pulą połączeń, a inicjalizator kubełka hosted service —
      skan `AddErpModule` nie zna żadnego z tych cykli życia.
- [x] ~~Tabela metadanych artefaktu w schemacie modułu~~ — **świadomie pominięta**. Nazwa pliku,
      typ MIME, rozmiar i wygasanie jadą jako metadane obiektu w MinIO; magazyn i tak je trzyma,
      a druga kopia byłaby drugim źródłem prawdy do utrzymania przy każdym zapisie i usunięciu.
      Rekordem, po którym artefakt się znajduje i autoryzuje, jest `ExportRun.ArtifactUuid`.
      Tabela stanie się potrzebna dopiero przy producencie artefaktów bez własnego agregatu.
- [x] Zapis **strumieniowy** — bez `byte[]`, bez materializacji całego artefaktu

### 2.3 `job.kind`

- [x] Enum `JobKind { Map = 0, Reduce = 1 }` w `Erp.BuildingBlocks.Jobs`
- [x] Kolumna `kind` w `job` + migracja `AddJobKind` dla Catalogu i Identity, `defaultValue: 0`
      (`Map`), więc istniejące wiersze zostają poprawne. **Sales pominięty** — jego `DbContext`
      nie implementuje `IJobDbContext` i nie ma tabel `job`/`job_item`, mimo że ma endpoint
      wsadowy. To zastany rozjazd, nie skutek tej zmiany.
- [x] `BulkCommandRunner.ProcessNextChunkAsync` filtruje `kind = Map` (bez tego podjąłby przebieg
      eksportu i uznał go za puste zadanie)
- [x] Dopisz `ExportRunner` do listy założeń jednoinstancyjnych w
      [`docs/architecture/backend.md` §7](../../docs/architecture/backend.md#7-założenia-jednoinstancyjne)

### 2.4 `ExportRun` + `ExportRunner`

Pierwszy moduł: Catalog (eksport produktów do XML).

- [x] Agregat `ExportRun` w `Catalog.Domain/Aggregates/ExportRuns/` + konfiguracja EF + migracja
- [x] `ExportRunCreateCommand` + handler (zwykły `Create`, uuid od klienta)
- [x] `ExportRunner : BackgroundService` — `IAsyncEnumerable` ze źródła, strumień do
      `IArtifactStore`, postęp co ~500 rekordów, **artefakt zapisany przed zmianą statusu**
- [x] Zapytania `IExportRunQueries` (`searchExportRun`, `getExportRun`)

### 2.5 Podpięcie

- [x] `AggregateSignatures.CatalogExportRun = "catalog.export_run"`
- [x] Uprawnienie `catalog.export_run.create` w `Erp.BuildingBlocks.Contracts/Permissions`.
      Nadanie roli **nie wymagało żadnej zmiany**: `RoleSeeder` uzgadnia rolę `administrator`
      z `Permissions.All` przy każdym starcie Identity, więc nowy kod trafił do katalogu
      i do roli sam. Zweryfikowane w bazie.
- [x] Endpoint pobrania — presigned URL z krótkim TTL, generowany **na żądanie**, za sprawdzeniem
      uprawnienia; nigdy zapisywany w rekordzie
- [x] Lifecycle policy MinIO (`erp-artifact-retention`) ustawiana przy każdym starcie modułu,
      z tej samej opcji `Artifacts:RetentionDays`, z której liczy się `job.expire_on` —
      jedno źródło prawdy zamiast dwóch konfiguracji do rozjechania.
- [x] **Poprawka projektowa w trakcie:** endpoint eksportu przestał dziedziczyć po
      `CreateBatchEndpointBase`. Przez bazę wsadową powstawały **dwa** zadania na jeden eksport
      (map-owe wykonujące komendę + `Reduce` robiące plik), a klient dostawał `jobUuid` tego
      pierwszego — dzwonek pokazywał „gotowe", zanim eksport się zaczął. Teraz jest to zwykły
      `ExportRunCreateCommandEndpoint` zwracający `BatchResult` z uuid zadania `Reduce`.
      Test `Komenda_i_endpoint_maja_zgodne_nazwy` dopuszcza sufiks `CommandEndpoint` obok
      `MultipleCommandEndpoint`.

---

## Etap 3 — Kontrakt wyniku do frontu

Pola `resultJson`/`resultType` istniały kiedyś w `JobRecord` i **zostały usunięte**, bo nie miały
pokrycia w backendzie (komentarz w `orchestrator.types.ts`). Wracają — ale jako **referencja**,
nie payload.

- [x] Pole nazwane `resultRef`, nie `artifactUuid` — **generyczne, nie eksportowe**. Siedzi na
      `Job` (building block), więc nie może znać pojęcia „artefakt eksportu"; niesie referencję,
      którą interpretuje moduł wykonujący zadanie. Dla eksportu jest to uuid przebiegu, po którym
      klient prosi o link. Pełny łańcuch: `Job.ResultRef` → `JobCompleted.ResultRef` (dodatek
      z domyślnym `null`, zgodny wstecz) → replika w Notification → `JobDto.resultRef`.
      Trzy migracje `AddJobResultRef` (Catalog, Identity, Notification) zastosowane.
- [x] `JobRecord.resultRef` w `frontend/libs/shared/data-access/src/lib/orchestrator/orchestrator.types.ts`
- [x] Mapowanie w `job-feed.service.ts` / `job.view-model.ts`
- [x] Akcja „Pobierz" w `erp-job-item.component.ts` — `output()`, renderowana warunkowo, znika po
      `expireOn`. Rozważ slot na akcję zamiast zaszytego przycisku (komponent jest ogólnego użytku)
- [x] Kolumna akcji w `notification-job-table.component.ts`
- [x] „Wyczyść zakończone" w `job-list.component.ts` — nie oferuj dla zadań z artefaktem albo
      przemianuj na „Ukryj"

---

## Etap 4 — `ErpToastService`

Docelowy kształt i uzasadnienie rozmieszczenia:
[`docs/guides/frontend/notifications.md` §4-6](../../docs/guides/frontend/notifications.md).

- [x] Atom w `libs/shared/ui/src/lib/erp-toast/` wzorcem Single Config Builder
      (`.types.ts` / `.builder.ts` / `.component.ts` / `index.ts`)
- [x] Serwis **w `shared/ui` obok atomu**, nie w `shared/data-access` jak zakładał plan.
      `ErpToastConfig` niesie `Translatable` i `ErpIcon` z `shared/ui`, a `type:data-access`
      może zależeć tylko od `{data-access, util}` — warstwa danych nigdy nie zobaczy tego
      kontraktu, a `shared/util` w repo nie istnieje. `show` / `update` / `dismiss` /
      `dismissAll`, stos (limit 4) zamiast pojedynczego sygnału.
- [x] Host stosu (`erp-toast-host.component.ts`) zastępuje `ErpToastBridgeComponent`;
      **zachowaj samodzielny banerek**, nie wracaj do `TuiAlertService` (`NG0201`)
- [x] Migracja wołających: `erp-permission-error.interceptor.ts`, `erp-user-badge.component.ts` —
      przekazują **klucz** tłumaczenia, nie przetłumaczony string
- [x] Usuń `erp-toast-bridge.service.ts` i `erp-toast-bridge.component.ts`
- [x] `notifyOnComplete` w `JobMeta` (opt-in, żeby bulki nie spamowały). Toast wystrzeliwuje
      `ErpJobToastBridge` w **hoście**, nie `JobService` — ten jest w `data-access` i nie widzi
      `ErpToastService` z `ui`. Most czeka na rozstrzygnięty status i pilnuje, żeby jedno
      zakończenie nie dało trzech toastów.
- [x] `role="alert"` tylko dla błędów, `role="status"` dla reszty

---

## Etap 5 — Poprawki zastane

Niezależne od reszty, warto zrobić od razu.

### 5.1 Feed zadań filtrowany po `clientId` zamiast `userId`

`job-feed.service.ts:163` mówi wprost, że filtr po `clientId` jest tymczasowy „dopóki backend nie
ma uwierzytelniania". **JWT już jest.** Skutek: użytkownik, który zlecił długie zadanie w jednej
przeglądarce, w drugiej ma pustą historię — czyli nie ma skąd pobrać raportu. To jest **warunek
konieczny**, żeby etapy 2–3 miały sens.

**Zrobione inaczej i szerzej, niż zakładał plan.** Pierwotny pomysł — front wysyła własne
`userId` zamiast `clientId` — okazał się niewykonalny i zarazem niewystarczający:

1. **Granice warstw go blokują.** `job-feed.service.ts` leży w `type:data-access`, a to może
   zależeć tylko od `{data-access, util}` — nie od `type:auth`, gdzie mieszka tożsamość.
   Front nie ma jak legalnie poznać własnego `userId` w tym miejscu.
2. **`userId` jako filtr z żądania był dziurą.** `JobQueries` robił po nim `ILIKE`, a endpointy
   zadań są świadomie bez `Permissions(...)`. Dowolny zalogowany użytkownik mógł podać cudze
   `userId` i odczytać czyjś feed; `getJob` po uuid nie sprawdzał właściciela w ogóle.

Zawężenie poszło więc **na serwer**, gdzie tożsamość i tak już jest:

- [x] `IJobQueries.SearchAsync/GetAsync` przyjmują `ownerUserId` jako osobny parametr,
      a zawężenie jest pierwszym i bezwarunkowym predykatem zapytania
- [x] `SearchJobEndpoint`/`GetJobEndpoint` biorą go z `IExecutionContext` (claim `sub`), nie z ciała
- [x] `SearchJobRequest.UserId` usunięte — filtr sterowany przez klienta nie miał prawa istnieć;
      `ClientId` zostaje jako opcjonalne zawężenie w obrębie własnych zadań
- [x] Front przestał wysyłać `clientId` w `job-feed.service.ts`; `job.store.ts` startuje z pustymi
      filtrami, więc historia od razu pokazuje zadania ze wszystkich urządzeń
- [x] Komentarze w obu plikach opisują stan faktyczny zamiast nieaktualnego ograniczenia

### 5.2 Nieaktualna sekcja w dokumentacji realtime

`docs/architecture/realtime.md` §2 wciąż niesie ostrzeżenie „Znany dług — brak autoryzacji",
podczas gdy `SyncHub` ma `[Authorize]`, a `userId` pochodzi z claimu `sub` przez
`SubjectUserIdProvider`. Dokumentacja opisuje stan bieżący, więc to jest usterka.

- [x] Usuń blok ostrzeżenia, opisz stan faktyczny (spójnie z komentarzem XML w `SyncHub.cs`)

---

## Kolejność

```
Etap 5  ──────────────────────────────────────▶  (od razu, niezależnie)

Etap 1  ──▶ regeneracja NSwag ──▶ front         (jedna paczka, jeden commit)

Etap 2  ──▶ Etap 3  ──▶ (Etap 4 opcjonalnie równolegle)
```

Etapów 1 i 2 nie łącz w jeden commit — pierwszy jest mechaniczny i łamiący, drugi jest nową
funkcjonalnością. Wspólny commit uniemożliwia rozdzielenie ich przy ewentualnym cofaniu.

---

## Weryfikacja

- [x] `dotnet test` — 90/90 przechodzi, w tym 4 nowe testy nazewnicze z 1.5
- [x] `npx tsc --noEmit` na dotkniętych bibliotekach + `nx lint` (0 błędów, tylko wcześniejsze
      ostrzeżenia `no-explicit-any`; granice modułów NX bez naruszeń)
- [x] **Regeneracja NSwag wykonana** (etap 3) na żywych serwisach dla catalog/identity/notification.
      Ręczne poprawki z etapu 1 okazały się co do znaku poprawne — diff na kliencie Identity to
      wyłącznie przesortowanie metod przez generator (39 linii w górę, 39 w dół, zero zmian
      semantycznych). Catalog +487 linii (endpointy eksportu), Notification +9 (`resultRef`).
- [x] `npx nx build client` — kompilacja szablonów Angulara przechodzi. Warta osobnego kroku:
      `tsc --noEmit` NIE sprawdza szablonów i przepuścił dwa realne błędy w `erp-toast`
      (sygnał wpychany do pipe'a tłumaczeń, prywatne pole użyte w szablonie).
- [x] **Etap 3 na żywej infrastrukturze:** `ExportRunner` → `Job.ResultRef` → `JobCompleted`
      przez RabbitMQ → replika w Notification. `notification.job.result_ref` = uuid przebiegu,
      status `Completed`, 1500 rekordów.
- [x] **Etap 4 w przeglądarce** (dev server, `window.ng` na komponencie hosta):
      cztery toasty naraz na stosie (poprzednia implementacja pokazywała jeden),
      `role="alert"` dla warning/negative i `status` dla pozostałych, tłumaczenia rozwiązane
      z realnych kluczy, auto-close po zadanym czasie, toast z akcją trwały, `update` podmienia
      w miejscu (jeden wpis, nowa treść), `update` na zamkniętym toaście go nie wskrzesza,
      kliknięcie akcji wywołuje callback, stos przycięty do 4 przy ośmiu wystrzeleniach,
      `dismissAll` czyści. W konsoli tylko oczekiwane 401 SignalR na stronie logowania.
- [x] **Ręcznie: operacja masowa w Identity → dzwonek → historia zadań.** Nadanie roli
      „Odczyt magazynu" użytkownikowi `testuser@erp.local` z toolbara listy użytkowników:
      `identity.job` = `UserAddRoleCommand` `Completed` 1/1, replika w `notification.job`
      w tej samej sekundzie, dzwonek pokazał „Nadanie roli użytkownikowi — Zakończone 1 z 1",
      a `/notification/jobs` pokazuje wpis również po twardym odświeżeniu strony.
- [x] **Etap 2 na żywej infrastrukturze** (podman: postgres, rabbitmq, keycloak, minio):
      - `IArtifactStore` — zapis strumieniowy 342 KB, nazwa pliku z polskimi znakami w obie
        strony, odczyt, presigned GET → 200 z poprawną treścią, usunięcie, usunięcie
        nieistniejącego bez wyjątku, zero osieroconych plików tymczasowych
      - migracje `AddJobKind` (Catalog + Identity) i `AddExportRun` zastosowane; kolumna `kind`
        i indeks `ix_job_kind_status_created_at` potwierdzone w bazie
      - pełny przebieg eksportu: `ExportRun` → `ExportRunner` → XML 1500 produktów (161 KiB)
        w MinIO → `export_run.status = Completed` z `artifact_uuid` → `job` (`kind=1`)
        `Completed`, `succeeded=1500`, `failed=0`
      - reguła lifecycle `erp-artifact-retention` = 7 dni w kubełku
      - uprawnienie `catalog.export_run.create` w katalogu i nadane roli `administrator`
      - endpointy w OpenAPI pod właściwymi ścieżkami; bez tokenu 401, z tokenem bez uprawnienia 403
- [x] **Autoryzowana ścieżka HTTP eksportu — ZWERYFIKOWANA** (tokenem zalogowanego użytkownika,
      z poziomu aplikacji; `directAccessGrants` pozostaje wyłączone i nie było ruszane).
      `POST /exportRun/create` → 200 z `jobUuid`, `ExportRunner` → zadanie `Completed`
      z `succeeded=1502` i `result_ref` wskazującym przebieg, `POST getExportRunDownloadUrl`
      → 200 z presigned URL do `erp-catalog-artifacts/assets/…`, pobranie spod tego adresu
      → 200 i 152 806 bajtów XML-a zaczynającego się od `<products>`.

> **Front nie ma dziś przycisku eksportu** — akcje „Eksport CSV/XML" w toolbarze produktów są
> zaślepkami (`console.log`), więc ścieżkę wywołano żądaniem HTTP z sesji zalogowanego
> użytkownika. Zweryfikowane jest to, co miało być zweryfikowane (autoryzacja + cały łańcuch),
> ale przycisk pozostaje do zrobienia.
- [~] Ręcznie: eksport w Catalogu → toast z akcją → zamknięcie toasta → pobranie z dzwonka →
      pobranie z historii → po `expire_on` akcja znika.
      **Częściowo:** zadanie eksportu pojawia się w dzwonku z akcją „Pobierz" i w historii zadań
      (również po odświeżeniu strony), a `getExportRunDownloadUrl` oddaje działający presigned URL
      (sprawdzone żądaniem). **Zostaje do sprawdzenia przez człowieka:** samo kliknięcie „Pobierz"
      (zapis pliku na dysk), droga przez toast — dziś nieosiągalna, bo front nie ma przycisku
      eksportu — oraz zniknięcie akcji po `expire_on` (7 dni; wymaga cofnięcia daty w bazie).
- [ ] Ręcznie: zalogowanie w drugiej przeglądarce pokazuje te same zadania (weryfikacja 5.1).
      Wymaga drugiego logowania (hasło), więc nie zostało wykonane automatycznie.
