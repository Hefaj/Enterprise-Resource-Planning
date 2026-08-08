# Enterprise Resource Planning — kontekst dla Claude

Ten plik jest zawsze wczytywany na starcie sesji. Pełne, szczegółowe reguły leżą w `.agents/rules/*.md` i `.agents/skills/*` — poniżej reguły `always_on` są wciągnięte wprost, a reguły `manual` (przepisy na konkretne zadania) są tylko zaindeksowane. Gdy zadanie pasuje do wiersza w tabeli niżej, **przeczytaj wskazany plik przed rozpoczęciem pracy**.

## Architektura (zawsze obowiązuje)

- **Monorepo**: Angular NX + **Native Federation** (mikrofrontendy, nie Webpack Module Federation). Root workspace zawiera `nx.json`, `tsconfig.base.json`, frontend w `frontend/`.
- **Struktura**: `frontend/apps/client` (host, port 4200) + `frontend/apps/modules/MODULE_NAME` (remote'y, porty 4201+). Biblioteki w `frontend/libs/{client,shared,modules/MODULE_NAME}`.
- **5 warstw modułu** (każdy moduł w `libs/modules/`): `contract` (routing/menu/modale, eksponowany przez Native Federation) → `feature` (smart components, logika) → `ui` (dumb/prezentacyjne komponenty TaigaUI) → `data-access` (HTTP/NSwag, orkiestratory, Signal Stores) → `util` (helpery, modele, stałe). Zależności wymuszone przez ESLint (`@nx/enforce-module-boundaries`): contract→{feature,ui,auth,data-access,util,env}; feature→{ui,data-access,util}; ui→{ui,util}; data-access→{data-access,util}.
- **Tags NX**: `scope:MODULE_NAME` (domena) + `type:WARSTWA`. `scope:X` może importować tylko z `scope:shared` i `scope:X`.
- **Aliasy TS**: `@erp/MODULE_NAME/WARSTWA` (np. `@erp/catalog/feature`).
- **Selektory**: `erp-*` w bibliotekach, `app-*` w aplikacjach.
- **Native Federation HMR**: wewnętrzne biblioteki modułu (`@erp/MODULE_NAME/{feature,data-access,ui,util}`) muszą być w tablicy `skip` w `federation.config.mjs`, inaczej `shareAll()` je pre-bundluje i tracą Vite HMR. `@erp/shared/*` i zależności zewnętrzne są `shared` (bez HMR, wymagają restartu).
- **Package manager**: pnpm.
- Szczegóły (module-loaders, manifest, STARTUP.ts, REMOTE_MODULES_CONFIG) → `.agents/rules/architektura-frontend.md`.

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
| Nowy modal (lazy-loaded, przez `ErpModalService`) | `.agents/rules/nowy-modal.md` |
| Nowy moduł — cz. 1: generacja NX, `project.json` hybrydowy (monolit/MFE), `federation.config.mjs`, `main.ts`/`main.mfe.ts` | `.agents/rules/nowy-modul-1-generacja.md` |
| Nowy moduł — cz. 2: biblioteki, tłumaczenia, rejestracja w Client (manifest, routing, `REMOTE_MODULES_CONFIG`), ESLint, tsconfig, weryfikacja | `.agents/rules/nowy-modul-2-integracja.md` |
| Orkiestrator w `data-access` (`BaseOrchestrator`, cache `IdentityMapStore`, SignalR, mapowanie DTO→ViewModel) | `.agents/rules/tworzenie-orkiestratora.md` |
| Nowy atom UI wg wzorca "Single Config Builder" (`*.types.ts`/`*.builder.ts`/`*.component.ts`) | `.agents/rules/atomy.md` |
| Praca z komponentami TaigaUI (API, migracja z PrimeNG, dialogi, selecty, textfields) | `.agents/skills/taiga-ui/SKILL.md` |

**Mapa portów**: client 4200, catalog 4201, inventory 4202, sales 4203, dms 4204, task-management 4205, notification 4206, nowy moduł → następny wolny.

## Backend

.NET 10 C# — **mikroserwisy**, każdy moduł frontendowy woła bezpośrednio API swojego mikroserwisu (`API_BASE_URL` per moduł, patrz `remote-api.providers.ts`). **Brak warstwy BFF/agregacji.**
