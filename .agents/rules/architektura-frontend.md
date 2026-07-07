---
trigger: always_on
---

# Architektura Frontendowa — Kontekst dla Agentów

## Przegląd

Projekt to **Angular NX Monorepo** z **Module Federation** (mikrofrontendy).  
Workspace root: katalog zawierający `nx.json`, `tsconfig.base.json`, `eslint.config.mjs`.  
Frontend jest w podkatalogu `frontend/`.

## Struktura katalogów

```
frontend/
├── apps/
│   ├── client/                      # HOST application (port 4200)
│   │   ├── public/
│   │   │   └── module-federation.manifest.json  # Rejestr remotów (dynamiczny MF)
│   │   ├── src/
│   │   │   ├── main.ts              # Ładuje manifest → registerRemotes → bootstrap
│   │   │   ├── bootstrap.ts         # bootstrapApplication(App, appConfig)
│   │   │   └── app/
│   │   │       ├── app.config.ts    # Providery, router (appRoutes z @erp/client/contract)
│   │   │       ├── STARTUP.ts       # APP_INITIALIZER — ładuje menu z remotów
│   │   │       └── app.ts           # Root component (router-outlet)
│   │   ├── module-federation.config.ts
│   │   └── webpack.config.ts
│   │
│   ├── modules/
│   │   ├── catalog/                 # REMOTE app (port 4201)
│   │   ├── inventory/               # REMOTE app (port 4202)
│   │   ├── sales/                   # REMOTE app (port 4203)
│   │   ├── dms/                     # REMOTE app (port 4204)
│   │   └── task-management/         # REMOTE app (port 4205)
│   │
│   └── module-federation.shared.ts  # Współdzielona konfiguracja MF
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
│       │   ├── contract/            # Routes + Menu (eksponowane przez MF)
│       │   ├── feature/             # RemoteEntry + Page components
│       │   ├── ui/                  # Prezentacyjne komponenty
│       │   ├── data-access/         # API clients (NSwag), Stores
│       │   └── util/                # Helpery, modele
│       ├── inventory/
│       ├── sales/
│       ├── dms/
│       └── task-management/
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
| **contract** | `type:contract` | Routing (`remoteRoutes`), menu (`remoteMenu`). Eksponowany przez Module Federation. |
| **feature** | `type:feature` | Smart components (logika), `RemoteEntry`. Używa serwisów z data-access i komponentów z ui. |
| **ui** | `type:ui` | Prezentacyjne (dumb) komponenty. Tylko `@Input`/`@Output`, brak serwisów. |
| **data-access** | `type:data-access` | Serwisy HTTP (NSwag API Clients), Signal Stores, orchestratory. |
| **util** | `type:util` | Funkcje pomocnicze, interfejsy, modele widokowe, stałe. |

## Module Federation — jak działa

1. **Host (`client`)** startuje na porcie **4200**
2. `main.ts` pobiera `module-federation.manifest.json` i rejestruje remoty dynamicznie
3. `STARTUP.ts` ładuje `contract` z każdego remota (menu), tworzy nawigację
4. Routing w `app.routes.ts` używa `loadRemote()` aby leniwie załadować `remoteRoutes` z każdego modułu
5. Każdy **remote** eksponuje `./contract` wskazujący na `libs/modules/MODULE/contract/src/index.ts`

## Tagi i ESLint Boundaries

Każdy projekt NX ma dwa tagi:
- **scope**: domena (`scope:catalog`, `scope:shared`, `scope:host`)
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
