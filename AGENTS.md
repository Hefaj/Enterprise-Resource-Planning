# Enterprise Resource Planning — kontekst dla Codex

Ten plik jest zawsze wczytywany na starcie sesji. Pełne, szczegółowe przepisy zadaniowe leżą w `docs/architecture/`, `docs/guides/`, `docs/modules/`, `docs/operations/` i `.agents/skills/*` — poniżej jest ich skrót wciągnięty wprost, obowiązujący zawsze. Gdy zadanie pasuje do wiersza w tabeli niżej, **przeczytaj wskazany plik przed rozpoczęciem pracy** — zawiera dokładne komendy, szablony kodu i checklisty.

## Architektura (zawsze obowiązuje)

- **Monorepo**: Angular NX + **Native Federation** (mikrofrontendy, nie Webpack Module Federation). Root workspace zawiera `nx.json`, `tsconfig.base.json`, frontend w `frontend/`.
- **Struktura**: `frontend/apps/client` (host, port 4200) + `frontend/apps/modules/MODULE_NAME` (remote'y, porty 4201+). Biblioteki w `frontend/libs/{client,shared,modules/MODULE_NAME}`.
- **5 warstw modułu** (każdy moduł w `libs/modules/`): `contract` (routing/menu/modale, eksponowany przez Native Federation) → `feature` (smart components, logika) → `ui` (dumb/prezentacyjne komponenty TaigaUI) → `data-access` (HTTP/NSwag, orkiestratory, Signal Stores) → `util` (helpery, modele, stałe). Zależności wymuszone przez ESLint (`@nx/enforce-module-boundaries`): contract→{feature,ui,auth,data-access,util,env}; feature→{ui,data-access,util}; ui→{ui,util}; data-access→{data-access,util}.
- **Tags NX**: `scope:MODULE_NAME` (domena) + `type:WARSTWA`. `scope:X` może importować tylko z `scope:shared` i `scope:X`.
- **Aliasy TS**: `@erp/MODULE_NAME/WARSTWA` (np. `@erp/catalog/feature`).
- **Selektory**: `erp-*` w bibliotekach, `app-*` w aplikacjach.
- **Native Federation HMR**: wewnętrzne biblioteki modułu (`@erp/MODULE_NAME/{feature,data-access,ui,util}`) muszą być w tablicy `skip` w `federation.config.mjs`, inaczej `shareAll()` je pre-bundluje i tracą Vite HMR. `@erp/shared/*` i zależności zewnętrzne są `shared` (bez HMR, wymagają restartu).
- **Package manager**: pnpm.
- Szczegóły (module-loaders, manifest, STARTUP.ts, REMOTE_MODULES_CONFIG) → [`docs/architecture/frontend.md`](docs/architecture/frontend.md).

## Standardy Angular (zawsze obowiązuje)

- Standalone Components domyślnie (bez NgModules), Signal-based state, nowa składnia Control Flow (`@if`, `@for`, `@switch`).
- **TaigaUI v5+** to główna biblioteka UI — nie zakładaj PrimeNG, chyba że kod legacy już go używa lub użytkownik explicite o to prosi.
- Styling: **Tailwind CSS v4** (już w `package.json`) do layoutu, spacingu i ogólnego stylowania + zmienne `--tui-*` / design tokens TaigaUI dla stylowania komponentów TaigaUI, których Tailwind nie pokrywa.
- Rozdzielaj Smart Components (logika, serwisy) od UI Components (prezentacja, TaigaUI) przy tworzeniu Page/Feature.
- Przy refaktorze: konwertuj stare wzorce Observable na Signals, migruj legacy structural directives na nową składnię.
- Nie modyfikuj `package-lock.json` ani `node_modules`. Przed utworzeniem nowej biblioteki sprawdź, czy istniejąca może hostować komponent.

## Tłumaczenia — Transloco (zawsze obowiązuje)

- **Zero hardcoded stringów** w TS/HTML widocznych dla użytkownika — tylko typowane klucze z registry (np. `PRODUCT_KEYS.base.filters.name.placeholder`).
- Atomy/molekuły/organizmy UI (`erp-button`, `erp-modal`, `erp-table`...) są "translation-aware" przez pipe `erpTranslate` w szablonie — smart components przekazują tylko surowe klucze string.
- **Nigdy** nie dodawaj `providers: [provideSharedTranslations()]` w dekoratorze `@Component` komponentu współdzielonego (`libs/shared/ui/**`) — to tworzy child injector, który przesłania scope Transloco nadrzędnego modułu (DI shadowing → `Missing translation for ...`). Rejestruj globalne scope'y tylko w `app.config.ts` / agregujących providerach modułu.
- Definicje modali **nie wywołują** `.setProviders(...)` w builderze — `ErpModalService` sam wstrzykuje providery przez `getModalProviders()` eksportowane z `entry.modals.ts` kontraktu remota.
- `keys.ts` jest **autogenerowany — nigdy nie edytuj ręcznie**. Procedura: dodaj klucze do `translation/pl-PL.json` i `en-US.json`, potem uruchom z roota:
  ```bash
  pnpm translate:keys
  ```

## Przepisy zadaniowe (przeczytaj plik, gdy pasuje)

<!-- generated:documentation-index:start -->
| Zadanie / sygnał | Obowiązkowy dokument |
|---|---|
| aktualizacja dokumentacji po zmianie funkcji; review dokumentacji | [`docs/contributing/documentation.md`](docs/contributing/documentation.md) |
| architektura backendu; granice mikroserwisów i danych | [`docs/architecture/backend.md`](docs/architecture/backend.md) |
| architektura frontendu; Native Federation lub granice bibliotek Nx | [`docs/architecture/frontend.md`](docs/architecture/frontend.md) |
| autoryzacja role i uprawnienia; Keycloak i Identity | [`docs/architecture/security.md`](docs/architecture/security.md) |
| domena DMS lub obieg dokumentu; DocumentType workflow ACL lub KSeF | [`docs/modules/dms/domain-workflow.md`](docs/modules/dms/domain-workflow.md) |
| domena Task Management; Issue workflow board lub automation | [`docs/modules/task-management/domain.md`](docs/modules/task-management/domain.md) |
| eksport raport lub plik do pobrania; IArtifactStore i MinIO | [`docs/guides/backend/exports-artifacts.md`](docs/guides/backend/exports-artifacts.md) |
| gdzie umieścić plik w repozytorium; mapa katalogów monorepo | [`docs/reference/repository-map.md`](docs/reference/repository-map.md) |
| komenda lub zapytanie CQRS; pipeline komend i X-Request-Id | [`docs/guides/backend/cqrs.md`](docs/guides/backend/cqrs.md) |
| migracja EF lub mapowanie agregatu; seed lub closure table | [`docs/guides/backend/persistence-ef.md`](docs/guides/backend/persistence-ef.md) |
| multimedia produktu; upload miniatura lub biblioteka mediów | [`docs/guides/frontend/multimedia.md`](docs/guides/frontend/multimedia.md) |
| nazwanie komendy lub endpointu; zmiana kontraktu NSwag | [`docs/guides/backend/endpoint-naming.md`](docs/guides/backend/endpoint-naming.md) |
| nowy atom UI; Single Config Builder | [`docs/guides/frontend/atoms.md`](docs/guides/frontend/atoms.md) |
| nowy mikroserwis backendowy; nowy DbContext lub moduł backendowy | [`docs/guides/backend/new-microservice.md`](docs/guides/backend/new-microservice.md) |
| nowy modal lazy loaded; ErpModalService | [`docs/guides/frontend/modals.md`](docs/guides/frontend/modals.md) |
| nowy moduł frontendowy; nowy remote Native Federation | [`docs/guides/frontend/new-module.md`](docs/guides/frontend/new-module.md) |
| nowy page dla agregatu; panel zależny od zaznaczenia | [`docs/guides/frontend/pages.md`](docs/guides/frontend/pages.md) |
| obserwowalność produkcyjna; health check alert lub korelacja X-Request-Id | [`docs/operations/observability.md`](docs/operations/observability.md) |
| operacja masowa bulk; BatchEndpointBase lub BulkCommandRunner | [`docs/guides/backend/bulk-commands.md`](docs/guides/backend/bulk-commands.md) |
| optymistyczna aktualizacja; ErpOptimisticStore | [`docs/guides/frontend/optimistic-updates.md`](docs/guides/frontend/optimistic-updates.md) |
| orkiestrator data-access; cache IdentityMapStore lub drzewo | [`docs/guides/frontend/orchestrators.md`](docs/guides/frontend/orchestrators.md) |
| pliki w module biznesowym; usuwanie lub sprzątanie multimediów | [`docs/guides/backend/media-storage.md`](docs/guides/backend/media-storage.md) |
| port aplikacji lub mikroserwisu; konflikt portów w środowisku lokalnym | [`docs/reference/ports.md`](docs/reference/ports.md) |
| powiadomienie dla człowieka z modułu; UserNotificationRequested | [`docs/modules/notification/user-notifications.md`](docs/modules/notification/user-notifications.md) |
| powiadomienie lub toast na froncie; historia zadań i pobieranie artefaktu | [`docs/guides/frontend/notifications.md`](docs/guides/frontend/notifications.md) |
| przegląd architektury całego systemu; ustalenie granicy między modułami | [`docs/architecture/system-overview.md`](docs/architecture/system-overview.md) |
| raport zestawienie lub agregacja; ciężki przebieg Map Reduce | [`docs/architecture/reporting.md`](docs/architecture/reporting.md) |
| SignalR i nowa sygnatura agregatu; realtime resync lub koalescencja | [`docs/architecture/realtime.md`](docs/architecture/realtime.md) |
| skalowanie poziome lub druga instancja; cluster safe background service | [`docs/architecture/multi-instance.md`](docs/architecture/multi-instance.md) |
| smart tabela dla agregatu; paginowana lista serwerowa | [`docs/guides/frontend/smart-tables.md`](docs/guides/frontend/smart-tables.md) |
| strony DMS; karta dokumentu lub edytor obiegu | [`docs/modules/dms/screens.md`](docs/modules/dms/screens.md) |
| strony Task Management; układ listy zgłoszeń tablicy lub projektu | [`docs/modules/task-management/screens.md`](docs/modules/task-management/screens.md) |
| struktura katalogów feature; gdzie umieścić page modal lub komponent | [`docs/guides/frontend/feature-structure.md`](docs/guides/frontend/feature-structure.md) |
| tłumaczenia Transloco; brak tłumaczenia lub DI shadowing | [`docs/guides/frontend/translations.md`](docs/guides/frontend/translations.md) |
| użytkownik w module innym niż Identity; picker osoby lub ERP_USER_DIRECTORY | [`docs/guides/frontend/user-directory.md`](docs/guides/frontend/user-directory.md) |
| walidacja wsadowa; IBatchRule lub ValidationChain | [`docs/guides/backend/batch-validation.md`](docs/guides/backend/batch-validation.md) |
| wdrożenie produkcyjne; gateway TLS backup lub migracje wdrożeniowe | [`docs/operations/production.md`](docs/operations/production.md) |
| wymagania Task Management; kryteria akceptacji Issue | [`docs/modules/task-management/requirements.md`](docs/modules/task-management/requirements.md) |
| zaznacz wszystko lub akcja masowa; ErpSelectionScope | [`docs/guides/frontend/selection-scope.md`](docs/guides/frontend/selection-scope.md) |
| zdarzenie domenowe lub integracyjne; outbox i konsument RabbitMQ | [`docs/architecture/integration-events.md`](docs/architecture/integration-events.md) |
| zmiana w module Catalog; produkt multimedia gwarancja lub raport Catalogu | [`docs/modules/catalog/architecture.md`](docs/modules/catalog/architecture.md) |
| znaczenie pojęcia architektonicznego | [`docs/reference/glossary.md`](docs/reference/glossary.md) |
<!-- generated:documentation-index:end -->

**Mapa portów (frontend)**: client 4200, catalog 4201, inventory 4202, sales 4203, dms 4204, task-management 4205, notification 4206, identity 4207, nowy moduł → następny wolny.
**Mapa portów (backend, HTTP dev)**: catalog 5149, notification 5250, sales 5269, identity 5280, task-management 5290 — Inventory i Dms nie mają jeszcze backendu ani portu.

## Backend

.NET 10 C# — **mikroserwisy**, każdy moduł frontendowy woła bezpośrednio API swojego mikroserwisu (`API_BASE_URL` per moduł, patrz `remote-api.providers.ts`). **Brak warstwy BFF/agregacji.** Pełny obraz granic i mechanizmów → [`docs/architecture/backend.md`](docs/architecture/backend.md#1-zakres-architektury).

- **Clean Architecture per moduł**: `Domain` (agregaty, reguły, zdarzenia domenowe — zero EF/ASP.NET) → `Application` (komendy/handlery/zapytania, zna tylko abstrakcje) → `Infrastructure` (`DbContext`, EF, migracje, repozytoria, konsumery) → `Api` (endpointy FastEndpoints, `Program.cs`). Granice wymuszone testem `Erp.ArchitectureTests` (NetArchTest) — odpowiednik `@nx/enforce-module-boundaries` z frontu.
- **CQRS**: zapis przez `ICommand<T>`/`CommandHandler<,>` (FastEndpoints jako typy komendy/handlera, ale dyspozycja przez własny `ICommandDispatcher`, nie przez szynę FastEndpoints) + `IUnitOfWork`, agregat zawsze ze śledzeniem zmian. Każda komenda idzie przez pipeline: logowanie → walidacja wejścia (`IValidator<TCommand>`) → jednostka pracy → idempotencja (`X-Request-Id`). Handler **nie woła** `SaveChanges`; wywołujący, który chce jednej transakcji dla paczki komend, przejmuje granicę przez `dispatcher.OwnTransaction()`. Wyjątki mapuje na `ProblemDetails` `ErpProblemDetailsHandler`. Odczyt świadomie omija repozytoria — `AsNoTracking`, projekcja wprost do DTO przez `IXxxQueries`. Reguła: metoda agregatu waliduje **przed** zmianą stanu — na tym opiera się częściowy sukces operacji masowych.
- **Baza**: jeden Postgres, **schemat per moduł** (`catalog`, `notification`, `sales`), osobny `DbContext` i osobny łańcuch migracji. Joiny cross-schema zakazane — dane obce wyłącznie przez zdarzenia integracyjne.
- **Zdarzenia**: domain event (wewnątrz modułu) ≠ integration event (`Erp.BuildingBlocks.Contracts`, wersjonowany, tylko dodawanie pól). „Coś się zmieniło” (`AggregateChanged`) generuje się **automatycznie** ze skanu ChangeTrackera EF — handler komendy nigdy o tym nie pamięta ręcznie. Transactional outbox (Wolverine + RabbitMQ): koperta zapisuje się w **tej samej transakcji** co dane.
- **Operacje masowe**: kontrakt HTTP (`BatchCommand<T,TFilter>` → `BatchResult{JobUuid}`) jest zamrożony. Wykonanie idzie przez trwałe `job`/`job_item` w bazie i `BulkCommandRunner` (chunk = transakcja, sukces częściowy dozwolony) — nie przez kolejkę w pamięci.
- **Rejestracje DI nie idą do `Program.cs`**: handlery komend, reguły (`IBatchRule<T>`) i walidatory wsadowe (`IBatchValidator`), egzekutory zadań masowych oraz implementacje nazwane po interfejsie (`IProductQueries` → `ProductQueries`) wyłapuje skan zestawów w `AddErpModule` (`Erp.BuildingBlocks.Api`). Nowa komenda, reguła czy repozytorium **nie dopisuje `AddScoped`** nigdzie — ma tylko implementować właściwy interfejs i leżeć w `{Modul}.Application`/`{Modul}.Infrastructure`. Jawne zostają wyłącznie rejestracje niosące decyzję (nadpisania, hosted services, seedy, cykl życia inny niż scoped) — te wygrywają z konwencją.
- **Pliki**: **nie ma i nie będzie centralnego mikroserwisu do multimediów** — każdy moduł rozmawia z MinIO sam, przez `Erp.BuildingBlocks.Artifacts`. Moduł biznesowy jest właścicielem swoich plików, bo referencja i rekord pliku muszą leżeć w jednej transakcji (inaczej nie da się bezpiecznie sprzątać). Separacja dostępu idzie po trzech niezależnych osiach: uprawnienie na endpointcie (kto widzi plik), kubełek per moduł i klasa (jak długo żyje), klucz MinIO per serwis (co serwis w ogóle może dosięgnąć). Sprzątanie: lifecycle na prefiksie postojowym + outbox + kaskada w transakcji — **nie** worker kasujący po zerowej referencji. Szczegóły → [`docs/guides/backend/media-storage.md`](docs/guides/backend/media-storage.md).
- **SignalR**: jeden centralny hub, wyłącznie w Notification (`/hubs/sync`). Inne moduły publikują tylko `AggregateChanged`, nic nie wiedzą o SignalR. Sygnatury (`catalog.product`, `sales.customer`, `jobs`...) to kontrakt z frontendem — jedno źródło prawdy w `AggregateSignatures`, musi się zgadzać ze `signalrSignature` w orkiestratorach.
- **Wiele instancji jest wspierane** — wybór zadania masowego idzie przez `FOR UPDATE SKIP LOCKED`, eksport przez krótkie przejęcie i `heartbeat_at`, usługi cykliczne i praca startowa przez dzierżawę na advisory locku Postgresa, cache uprawnień przez broadcast na `erp.broadcast`, a realtime przez rozdział ról `Realtime:Role` (`Hub`/`Relay`) i backplane Redis. Redis jest potrzebny **wyłącznie** jako backplane SignalR; wszystko inne idzie przez Postgresa. Nowa usługa tła musi zadeklarować `[ClusterSafe(powód)]` — wymusza to test `BackgroundServiceTests`. Szczegóły: [`architecture.md` §7](docs/architecture/backend.md#7-wieloinstancyjność--założenia-zdjęte) i [`multi-instance.md`](docs/architecture/multi-instance.md). Nie dokładaj stanu współdzielonego w pamięci procesu bez odpowiedzi, co się z nim dzieje przy drugiej instancji.
- **Kontrakt HTTP jest zamrożony** dla klientów NSwag: nazwa klasy endpointu → nazwa metody klienta (`SearchProductEndpoint` → `searchProduct`), nazwa klasy komendy → nazwa typu w kliencie. Zmiana wymaga świadomej regeneracji, nie przypadkowego przemianowania.
