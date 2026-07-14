---
trigger: always_on
---

# Architektura Frontendowa — Kontekst dla Agentów

## Przegląd

Projekt to **Angular NX Monorepo** z **Native Federation** (mikrofrontendy oparte na standardzie ESBuild / browser-native ESM).  
Workspace root: katalog zawierający `nx.json`, `tsconfig.base.json`, `eslint.config.mjs`.  
Frontend jest w podkatalogu `frontend/`.

## Struktura katalogów

```
frontend/
├── apps/
│   ├── client/                      # HOST application (port 4200)
│   │   ├── public/
│   │   │   └── module-federation.manifest.json  # Rejestr remotów (dynamiczny manifest Native Federation)
│   │   ├── src/
│   │   │   ├── main.ts              # Inicjalizuje federację → initFederation → bootstrap
│   │   │   ├── bootstrap.ts         # bootstrapApplication(App, appConfig)
│   │   │   └── app/
│   │   │       ├── app.config.ts    # Providery, router (appRoutes z @erp/client/contract)
│   │   │       ├── STARTUP.ts       # APP_INITIALIZER — ładuje menu z remotów
│   │   │       └── app.ts           # Root component (router-outlet)
│   │   ├── federation.config.mjs    # Konfiguracja współdzielenia Native Federation dla hosta
│   │   └── vite.config.mts          # Konfiguracja deweloperska/testowa (Vite/Vitest)
│   │
│   └── modules/
│       ├── catalog/                 # REMOTE app (port 4201)
│       ├── inventory/               # REMOTE app (port 4202)
│       ├── sales/                   # REMOTE app (port 4203)
│       ├── dms/                     # REMOTE app (port 4204)
│       ├── task-management/         # REMOTE app (port 4205)
│       └── notification/            # REMOTE app (port 4206)
│
├── libs/
│   ├── client/                      # Biblioteki specyficzne dla hosta
│   │   ├── contract/                # Routing hosta (appRoutes, REMOTE_MODULES_CONFIG)
│   │   ├── feature/                 # ShellLayout, Dashboard, Settings
│   │   ├── ui/
│   │   └── util/
│   │
│   ├── shared/                      # Biblioteki współdzielone (scope:shared)
│   │   ├── ui/                      # Komponenty TaigaUI / Wspólne UI
│   │   ├── auth/                    # Guard'y, serwisy auth
│   │   └── data-access/             # Wspólne serwisy (NavRegistry, etc.)
│   │
│   └── modules/
│       ├── catalog/                 # Biblioteki modułu catalog
│       │   ├── contract/            # Routes + Menu (eksponowane przez Native Federation)
│       │   ├── feature/             # RemoteEntry + Page components
│       │   ├── ui/                  # Prezentacyjne komponenty
│       │   ├── data-access/         # API clients (NSwag), Stores
│       │   └── util/                # Helpery, modele
│       ├── inventory/
│       ├── sales/
│       ├── dms/
│       ├── task-management/
│       └── notification/
```

## Warstwy modułu (biblioteki)

Każdy moduł składa się z **5 bibliotek**. Zależności między nimi są wymuszone przez ESLint (`@nx/enforce-module-boundaries`):

```
contract  →  feature, ui, auth, data-access, util, env
feature   →  ui, data-access, util
ui        →  ui, util
data-access → data-access, util
util      →  util, data-access
```

| Warstwa | Tag | Odpowiedzialność |
|---------|-----|------------------|
| **contract** | `type:contract` | Routing (`remoteRoutes`), menu (`remoteMenu`). Eksponowany przez Native Federation. |
| **feature** | `type:feature` | Smart components (logika), `RemoteEntry`. Używa serwisów z data-access i komponentów z ui. |
| **ui** | `type:ui` | Prezentacyjne (dumb) komponenty. Tylko `@Input`/`@Output`, brak serwisów. |
| **data-access** | `type:data-access` | Serwisy HTTP (NSwag API Clients), Signal Stores, orchestratory. |
| **util** | `type:util` | Funkcje pomocnicze, interfejsy, modele widokowe, stałe. |

## Native Federation — jak działa

1. **Host (`client`)** startuje na porcie **4200**.
2. Plik `main.ts` wywołuje `initFederation('/module-federation.manifest.json')`. Pobiera on manifest z adresami remotów oraz ich plikami `remoteEntry.json`.
3. Po pomyślnej inicjalizacji Native Federation, następuje dynamiczny import pliku `bootstrap.ts` i uruchomienie aplikacji Angular (`bootstrapApplication`).
4. W trakcie startu, `STARTUP.ts` (APP_INITIALIZER) pobiera moduły kontraktów (`./contract`) z każdego aktywnego remota za pomocą metody `loadRemoteModule()`, rejestrując dynamicznie elementy menu i modalne ID.
5. Routing zdefiniowany w `@erp/client/contract` (plik `app.routes.ts`) używa `loadRemoteModule()` z `@angular-architects/native-federation` do leniwego ładowania tras (`remoteRoutes`) poszczególnych modułów.
6. Każdy **remote** w pliku `federation.config.mjs` eksponuje `./contract` wskazujący na punkt wejściowy swojej biblioteki kontraktu (`libs/modules/MODULE/contract/src/index.ts`).
7. Bundling w trybie developerskim i produkcyjnym opiera się na **Esbuild** za pośrednictwem executora `@angular/build:application`, a Native Federation zarządza współdzieleniem zależności (zgodnie z sekcją `shared` w `federation.config.mjs`) generując natywne import mapy przeglądarki.

## Tagi i ESLint Boundaries

Każdy projekt NX ma dwa tagi:
- **scope**: domena (`scope:catalog`, `scope:shared`, `scope:host`, `scope:notification`, itd.)
- **type**: warstwa techniczna (`type:app`, `type:feature`, `type:contract`, `type:ui`, `type:data-access`, `type:util`)

Reguła `scope:MODULE_NAME` pozwala importować tylko z `scope:shared` i `scope:MODULE_NAME`.  
Reguła `scope:shared` pozwala importować tylko z `scope:shared`.

## Konwencje

- **Prefix komponentów w bibliotekach**: `erp` (selector: `erp-*`)
- **Prefix komponentów w aplikacjach**: `app` (selector: `app-*`)
- **Aliasy TS**: `@erp/MODULE_NAME/WARSTWA` (np. `@erp/catalog/feature`)
- **Standalone Components**: domyślne — bez NgModules
- **Signal-based state management**: preferowane
- **Control Flow**: `@if`, `@for`, `@switch` (nowa składnia Angular)
- **TaigaUI**: Używamy biblioteki TaigaUI (v5+) jako bazowego zestawu komponentów. Ewentualne stylowanie nadpisujemy za pomocą zmiennych CSS (`--tui-*`) lub dedykowanych klas CSS.
- **Package manager**: pnpm
