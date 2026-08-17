# Enterprise Resource Planning — kontekst dla Claude

Ten plik jest zawsze wczytywany na starcie sesji. Pełne, szczegółowe przepisy zadaniowe leżą w `docs/frontend/*.md`, `docs/backend/*.md` i `.agents/skills/*` — poniżej jest ich skrót wciągnięty wprost, obowiązujący zawsze. Gdy zadanie pasuje do wiersza w tabeli niżej, **przeczytaj wskazany plik przed rozpoczęciem pracy** — zawiera dokładne komendy, szablony kodu i checklisty.

## Architektura (zawsze obowiązuje)

- **Monorepo**: Angular NX + **Native Federation** (mikrofrontendy, nie Webpack Module Federation). Root workspace zawiera `nx.json`, `tsconfig.base.json`, frontend w `frontend/`.
- **Struktura**: `frontend/apps/client` (host, port 4200) + `frontend/apps/modules/MODULE_NAME` (remote'y, porty 4201+). Biblioteki w `frontend/libs/{client,shared,modules/MODULE_NAME}`.
- **5 warstw modułu** (każdy moduł w `libs/modules/`): `contract` (routing/menu/modale, eksponowany przez Native Federation) → `feature` (smart components, logika) → `ui` (dumb/prezentacyjne komponenty TaigaUI) → `data-access` (HTTP/NSwag, orkiestratory, Signal Stores) → `util` (helpery, modele, stałe). Zależności wymuszone przez ESLint (`@nx/enforce-module-boundaries`): contract→{feature,ui,auth,data-access,util,env}; feature→{ui,data-access,util}; ui→{ui,util}; data-access→{data-access,util}.
- **Tags NX**: `scope:MODULE_NAME` (domena) + `type:WARSTWA`. `scope:X` może importować tylko z `scope:shared` i `scope:X`.
- **Aliasy TS**: `@erp/MODULE_NAME/WARSTWA` (np. `@erp/catalog/feature`).
- **Selektory**: `erp-*` w bibliotekach, `app-*` w aplikacjach.
- **Native Federation HMR**: wewnętrzne biblioteki modułu (`@erp/MODULE_NAME/{feature,data-access,ui,util}`) muszą być w tablicy `skip` w `federation.config.mjs`, inaczej `shareAll()` je pre-bundluje i tracą Vite HMR. `@erp/shared/*` i zależności zewnętrzne są `shared` (bez HMR, wymagają restartu).
- **Package manager**: pnpm.
- Szczegóły (module-loaders, manifest, STARTUP.ts, REMOTE_MODULES_CONFIG) → [`docs/frontend/architecture.md`](docs/frontend/architecture.md).

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

| Zadanie | Plik |
|---|---|
| Nowy modal (lazy-loaded, przez `ErpModalService`) | [`docs/frontend/modals.md`](docs/frontend/modals.md) |
| Nowy moduł — generacja NX, `project.json` hybrydowy (monolit/MFE), `federation.config.mjs`, rejestracja w Client, tłumaczenia, weryfikacja | [`docs/frontend/new-module.md`](docs/frontend/new-module.md) |
| Orkiestrator w `data-access` (`BaseOrchestrator`, cache `IdentityMapStore`, SignalR, mapowanie DTO→ViewModel, wzorce dla drzew) | [`docs/frontend/orchestrators.md`](docs/frontend/orchestrators.md) |
| Nowy atom UI wg wzorca "Single Config Builder" (`*.types.ts`/`*.builder.ts`/`*.component.ts`) | [`docs/frontend/atoms.md`](docs/frontend/atoms.md) |
| Zaznaczenie i akcje masowe w UI — „Zaznacz wszystko" jako filtr, `ErpSelectionScope`, próg materializacji, panel boczny zależny od zaznaczenia, bramkowanie akcji toolbara | [`docs/frontend/selection-scope.md`](docs/frontend/selection-scope.md) |
| Tłumaczenia — dodawanie kluczy, bootstrapping scope'u, DI shadowing | [`docs/frontend/translations.md`](docs/frontend/translations.md) |
| Praca z komponentami TaigaUI (API, migracja z PrimeNG, dialogi, selecty, textfields) | `.agents/skills/taiga-ui/SKILL.md` |
| Nowy mikroserwis backendowy — 4 projekty Clean Architecture, `.sln`, `DbContext`, `Program.cs`, sygnatura SignalR | [`docs/backend/new-microservice.md`](docs/backend/new-microservice.md) |
| Komenda/zapytanie CQRS w module backendowym (handler, `IUnitOfWork`, projekcje, sortowanie po whiteliście) | [`docs/backend/cqrs.md`](docs/backend/cqrs.md) |
| Operacja masowa (bulk) — `BatchEndpointBase`, `job`/`job_item`, `BulkCommandRunner`, cancel/retry-failed | [`docs/backend/bulk-commands.md`](docs/backend/bulk-commands.md) |
| Walidacja wsadowa — `IBatchRule`, `ValidationChain`, pre-check przed utworzeniem zadania masowego | [`docs/backend/batch-validation.md`](docs/backend/batch-validation.md) |
| Zdarzenie domenowe / integracyjne, outbox, nowy konsument RabbitMQ | [`docs/backend/events-outbox.md`](docs/backend/events-outbox.md) |
| Realtime SignalR — nowa sygnatura, grupy, koalescencja, resync | [`docs/backend/realtime-signalr.md`](docs/backend/realtime-signalr.md) |
| Migracja EF, mapowanie agregatu, seed, drzewo/closure table | [`docs/backend/persistence-ef.md`](docs/backend/persistence-ef.md) |

**Mapa portów**: client 4200, catalog 4201, inventory 4202, sales 4203, dms 4204, task-management 4205, notification 4206, nowy moduł → następny wolny.

## Backend

.NET 10 C# — **mikroserwisy**, każdy moduł frontendowy woła bezpośrednio API swojego mikroserwisu (`API_BASE_URL` per moduł, patrz `remote-api.providers.ts`). **Brak warstwy BFF/agregacji.** Pełny obraz i stan wdrożenia poszczególnych elementów → [`docs/backend/architecture.md`](docs/backend/architecture.md#1-stan-wdrożenia).

- **Clean Architecture per moduł**: `Domain` (agregaty, reguły, zdarzenia domenowe — zero EF/ASP.NET) → `Application` (komendy/handlery/zapytania, zna tylko abstrakcje) → `Infrastructure` (`DbContext`, EF, migracje, repozytoria, konsumery) → `Api` (endpointy FastEndpoints, `Program.cs`). Granice wymuszone testem `Erp.ArchitectureTests` (NetArchTest) — odpowiednik `@nx/enforce-module-boundaries` z frontu.
- **CQRS**: zapis przez `ICommand<T>`/`CommandHandler<,>` (FastEndpoints jako mediator in-process, nie MediatR) + `IUnitOfWork`, agregat zawsze ze śledzeniem zmian. Odczyt świadomie omija repozytoria — `AsNoTracking`, projekcja wprost do DTO przez `IXxxQueries`. Reguła: metoda agregatu waliduje **przed** zmianą stanu — na tym opiera się częściowy sukces operacji masowych.
- **Baza**: jeden Postgres, **schemat per moduł** (`catalog`, `notification`, `sales`), osobny `DbContext` i osobny łańcuch migracji. Joiny cross-schema zakazane — dane obce wyłącznie przez zdarzenia integracyjne.
- **Zdarzenia**: domain event (wewnątrz modułu) ≠ integration event (`Erp.BuildingBlocks.Contracts`, wersjonowany, tylko dodawanie pól). „Coś się zmieniło” (`AggregateChanged`) generuje się **automatycznie** ze skanu ChangeTrackera EF — handler komendy nigdy o tym nie pamięta ręcznie. Transactional outbox (Wolverine + RabbitMQ): koperta zapisuje się w **tej samej transakcji** co dane.
- **Operacje masowe**: kontrakt HTTP (`BatchCommand<T,TFilter>` → `BatchResult{JobUuid}`) jest zamrożony. Wykonanie idzie przez trwałe `job`/`job_item` w bazie i `BulkCommandRunner` (chunk = transakcja, sukces częściowy dozwolony) — nie przez kolejkę w pamięci.
- **SignalR**: jeden centralny hub, wyłącznie w Notification (`/hubs/sync`). Inne moduły publikują tylko `AggregateChanged`, nic nie wiedzą o SignalR. Sygnatury (`catalog.product`, `sales.customer`, `jobs`...) to kontrakt z frontendem — jedno źródło prawdy w `AggregateSignatures`, musi się zgadzać ze `signalrSignature` w orkiestratorach.
- **Kontrakt HTTP jest zamrożony** dla klientów NSwag: nazwa klasy endpointu → nazwa metody klienta (`SearchProductEndpoint` → `searchProduct`), nazwa klasy komendy → nazwa typu w kliencie. Zmiana wymaga świadomej regeneracji, nie przypadkowego przemianowania.
