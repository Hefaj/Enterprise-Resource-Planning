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
| Smart tabela dla agregatu (lista serwerowa `ErpTableBuilder`, wiersze z orkiestratora po UUID, paginacja/sortowanie) | [`docs/frontend/smart-tables.md`](docs/frontend/smart-tables.md) |
| Gdzie położyć plik w `feature` — struktura katalogów agregatu (`components`/`modal`/`page`/`translation`) | [`docs/frontend/feature-structure.md`](docs/frontend/feature-structure.md) |
| Nowy page dla agregatu (`erp-grid-layout`, filtr, smart tabela + action toolbar, zakładki i prawy panel zależny od zaznaczenia, store strony) | [`docs/frontend/pages.md`](docs/frontend/pages.md) |
| Nowy atom UI wg wzorca "Single Config Builder" (`*.types.ts`/`*.builder.ts`/`*.component.ts`) | [`docs/frontend/atoms.md`](docs/frontend/atoms.md) |
| Zaznaczenie i akcje masowe w UI — „Zaznacz wszystko" jako filtr, `ErpSelectionScope`, próg materializacji, panel/zakładka zależna od zaznaczenia (`ProductScopeTabStore`, `erp-selection-scope-banner`), bramkowanie akcji toolbara | [`docs/frontend/selection-scope.md`](docs/frontend/selection-scope.md) |
| Tłumaczenia — dodawanie kluczy, bootstrapping scope'u, DI shadowing | [`docs/frontend/translations.md`](docs/frontend/translations.md) |
| Multimedia produktu — wgrywanie plików (bilet → PUT do magazynu → rejestracja → dopięcie), miniaturki przez `blob:`, biblioteka mediów (`/catalog/multimedia`) i usuwanie zasobów | [`docs/frontend/multimedia.md`](docs/frontend/multimedia.md) |
| Powiadomienia na froncie — toast (`ErpToastService`), dzwonek, historia zadań, gdzie użytkownik ponownie pobierze artefakt, tłumaczenie kodów błędów backendu (`shared.errors.codes`) | [`docs/frontend/notifications.md`](docs/frontend/notifications.md) |
| Praca z komponentami TaigaUI (API, migracja z PrimeNG, dialogi, selecty, textfields) | `.agents/skills/taiga-ui/SKILL.md` |
| Nowy mikroserwis backendowy — 4 projekty Clean Architecture, `.sln`, `DbContext`, `Program.cs`, sygnatura SignalR | [`docs/backend/new-microservice.md`](docs/backend/new-microservice.md) |
| Komenda/zapytanie CQRS w module backendowym (handler, `IUnitOfWork`, projekcje, sortowanie po whiteliście) | [`docs/backend/cqrs.md`](docs/backend/cqrs.md) |
| Nazwanie nowej komendy/endpointu — pięć czasowników (`create`/`set`/`add`/`remove`/`exec`), człon = cel, trasy, co łamie kontrakt NSwag | [`docs/backend/endpoint-naming.md`](docs/backend/endpoint-naming.md) |
| Operacja produkująca plik (eksport, raport, dokument) albo plik wgrywany przez użytkownika — agregat przebiegu, `job.kind`, MinIO, `IArtifactStore`, dwa kubełki, wygasanie | [`docs/backend/exports-artifacts.md`](docs/backend/exports-artifacts.md) |
| Pliki w nowym module, separacja dostępu do multimediów (faktury vs zdjęcia), usuwanie i sprzątanie osieroconych plików | [`docs/backend/media-storage.md`](docs/backend/media-storage.md) |
| Operacja masowa (bulk) — `BatchEndpointBase`, `job`/`job_item`, `BulkCommandRunner`, cancel/retry-failed | [`docs/backend/bulk-commands.md`](docs/backend/bulk-commands.md) |
| Walidacja wsadowa — `IBatchRule`, `ValidationChain`, pre-check przed utworzeniem zadania masowego | [`docs/backend/batch-validation.md`](docs/backend/batch-validation.md) |
| Zdarzenie domenowe / integracyjne, outbox, nowy konsument RabbitMQ | [`docs/backend/events-outbox.md`](docs/backend/events-outbox.md) |
| Realtime SignalR — nowa sygnatura, grupy, koalescencja, resync | [`docs/backend/realtime-signalr.md`](docs/backend/realtime-signalr.md) |
| Migracja EF, mapowanie agregatu, seed, drzewo/closure table | [`docs/backend/persistence-ef.md`](docs/backend/persistence-ef.md) |
| Autoryzacja/role/uprawnienia — Keycloak (AuthN), moduł Identity (AuthZ), `grant_audit`, wygasające nadania, wymuszone wylogowanie | [`docs/backend/identity-authz.md`](docs/backend/identity-authz.md) |

**Mapa portów (frontend)**: client 4200, catalog 4201, inventory 4202, sales 4203, dms 4204, task-management 4205, notification 4206, identity 4207, nowy moduł → następny wolny.
**Mapa portów (backend, HTTP dev)**: catalog 5149, notification 5250, sales 5269, identity 5280 (Inventory/Dms/Task-management nie mają jeszcze backendu — brak portu do czasu wdrożenia).

## Backend

.NET 10 C# — **mikroserwisy**, każdy moduł frontendowy woła bezpośrednio API swojego mikroserwisu (`API_BASE_URL` per moduł, patrz `remote-api.providers.ts`). **Brak warstwy BFF/agregacji.** Pełny obraz i stan wdrożenia poszczególnych elementów → [`docs/backend/architecture.md`](docs/backend/architecture.md#1-stan-wdrożenia).

- **Clean Architecture per moduł**: `Domain` (agregaty, reguły, zdarzenia domenowe — zero EF/ASP.NET) → `Application` (komendy/handlery/zapytania, zna tylko abstrakcje) → `Infrastructure` (`DbContext`, EF, migracje, repozytoria, konsumery) → `Api` (endpointy FastEndpoints, `Program.cs`). Granice wymuszone testem `Erp.ArchitectureTests` (NetArchTest) — odpowiednik `@nx/enforce-module-boundaries` z frontu.
- **CQRS**: zapis przez `ICommand<T>`/`CommandHandler<,>` (FastEndpoints jako mediator in-process, nie MediatR) + `IUnitOfWork`, agregat zawsze ze śledzeniem zmian. Odczyt świadomie omija repozytoria — `AsNoTracking`, projekcja wprost do DTO przez `IXxxQueries`. Reguła: metoda agregatu waliduje **przed** zmianą stanu — na tym opiera się częściowy sukces operacji masowych.
- **Baza**: jeden Postgres, **schemat per moduł** (`catalog`, `notification`, `sales`), osobny `DbContext` i osobny łańcuch migracji. Joiny cross-schema zakazane — dane obce wyłącznie przez zdarzenia integracyjne.
- **Zdarzenia**: domain event (wewnątrz modułu) ≠ integration event (`Erp.BuildingBlocks.Contracts`, wersjonowany, tylko dodawanie pól). „Coś się zmieniło” (`AggregateChanged`) generuje się **automatycznie** ze skanu ChangeTrackera EF — handler komendy nigdy o tym nie pamięta ręcznie. Transactional outbox (Wolverine + RabbitMQ): koperta zapisuje się w **tej samej transakcji** co dane.
- **Operacje masowe**: kontrakt HTTP (`BatchCommand<T,TFilter>` → `BatchResult{JobUuid}`) jest zamrożony. Wykonanie idzie przez trwałe `job`/`job_item` w bazie i `BulkCommandRunner` (chunk = transakcja, sukces częściowy dozwolony) — nie przez kolejkę w pamięci.
- **Rejestracje DI nie idą do `Program.cs`**: handlery komend, reguły (`IBatchRule<T>`) i walidatory wsadowe (`IBatchValidator`), egzekutory zadań masowych oraz implementacje nazwane po interfejsie (`IProductQueries` → `ProductQueries`) wyłapuje skan zestawów w `AddErpModule` (`Erp.BuildingBlocks.Api`). Nowa komenda, reguła czy repozytorium **nie dopisuje `AddScoped`** nigdzie — ma tylko implementować właściwy interfejs i leżeć w `{Modul}.Application`/`{Modul}.Infrastructure`. Jawne zostają wyłącznie rejestracje niosące decyzję (nadpisania, hosted services, seedy, cykl życia inny niż scoped) — te wygrywają z konwencją.
- **Pliki**: **nie ma i nie będzie centralnego mikroserwisu do multimediów** — każdy moduł rozmawia z MinIO sam, przez `Erp.BuildingBlocks.Artifacts`. Moduł biznesowy jest właścicielem swoich plików, bo referencja i rekord pliku muszą leżeć w jednej transakcji (inaczej nie da się bezpiecznie sprzątać). Separacja dostępu idzie po trzech niezależnych osiach: uprawnienie na endpointcie (kto widzi plik), kubełek per moduł i klasa (jak długo żyje), klucz MinIO per serwis (co serwis w ogóle może dosięgnąć). Sprzątanie: lifecycle na prefiksie postojowym + outbox + kaskada w transakcji — **nie** worker kasujący po zerowej referencji. Szczegóły → [`docs/backend/media-storage.md`](docs/backend/media-storage.md).
- **SignalR**: jeden centralny hub, wyłącznie w Notification (`/hubs/sync`). Inne moduły publikują tylko `AggregateChanged`, nic nie wiedzą o SignalR. Sygnatury (`catalog.product`, `sales.customer`, `jobs`...) to kontrakt z frontendem — jedno źródło prawdy w `AggregateSignatures`, musi się zgadzać ze `signalrSignature` w orkiestratorach.
- **Jedna instancja każdego serwisu.** Rozgłaszanie SignalR, licznik sekwencji, bufor koalescencji i wybór zadania masowego zakładają brak drugiej instancji — przy skalowaniu poziomym trzeba je ruszyć razem, patrz [`architecture.md` §7](docs/backend/architecture.md#7-założenia-jednoinstancyjne). Nie dokładaj stanu współdzielonego w pamięci procesu bez dopisania go do tej listy.
- **Kontrakt HTTP jest zamrożony** dla klientów NSwag: nazwa klasy endpointu → nazwa metody klienta (`SearchProductEndpoint` → `searchProduct`), nazwa klasy komendy → nazwa typu w kliencie. Zmiana wymaga świadomej regeneracji, nie przypadkowego przemianowania.
