---
trigger: manual
---

# Migracja z Monolitu na Mikrofrontendy (Native Federation)

## Kontekst

Projekt został **skonsolidowany do monolitu** z zachowaniem architektury MF-ready. Oznacza to, że:

- Struktura katalogów, warstwy bibliotek (`contract`, `feature`, `ui`, `data-access`, `util`) i tagi NX **zostały zachowane bez zmian**
- Usunięte zostały **pliki konfiguracyjne Native Federation** (`federation.config.mjs`) i manifest (`module-federation.manifest.json`)
- Routing i ładowanie kontraktów zmieniono z **`loadRemoteModule()` → bezpośrednie `import()`**
- Build przeszedł z **Native Federation executor → czysty `@angular/build:application`**
- Serwer deweloperski: **`@angular-architects/native-federation:build` → `@angular-devkit/build-angular:dev-server`**
- Remoty **nie startują osobno** — wszystko jest bundlowane w jednym procesie hosta

Dzięki zachowanej strukturze **migracja powrotna jest możliwa bez zmian w kodzie komponentów, serwisów ani szablonów.**

---

## Wymagania wstępne

Przed rozpoczęciem upewnij się, że masz zainstalowane wymagane pakiety:

```bash
pnpm add @angular-architects/native-federation @softarc/native-federation @softarc/native-federation-orchestrator es-module-shims
```

---

## Krok 1 — Przywrócenie `federation.config.mjs` dla hosta i każdego remota

### 1.1 Host (`frontend/apps/client/federation.config.mjs`)

```js
import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'client',

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
      {
        overrides: {
          '@angular/core': { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package', includeSecondaries: { keepAll: true } },
          '@angular/common/locales/pl': { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
        },
      },
    ),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Host-internal libs — skip dla Vite HMR
    '@erp/client/feature',
    '@erp/client/contract',
    '@erp/client/ui',
    '@erp/client/util',
    // Niewykorzystywane w runtime
    '@ng-web-apis/common',
    '@ng-web-apis/platform',
    '@ng-web-apis/screen-orientation',
    '@ng-web-apis/resize-observer',
    '@ng-web-apis/mutation-observer',
    '@taiga-ui/font-watcher',
    '@maskito/kit',
    'libphonenumber-js/core',
    '@maskito/phone',
    '@ng-web-apis/intersection-observer',
    '@jsverse/utils',
    '@softarc/native-federation/domain',
  ],

  features: {
    denseChunking: true
  }
});
```

### 1.2 Remote (szablon — np. `frontend/apps/modules/catalog/federation.config.mjs`)

Powtórz dla **każdego** remota (`catalog`, `inventory`, `sales`, `dms`, `task-management`, `notification`), zmieniając `name` i `skip`:

```js
import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'MODULE_NAME',

  exposes: {
    './contract': './frontend/libs/modules/MODULE_NAME/contract/src/index.ts',
  },

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
      {
        overrides: {
          '@angular/core': { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package', includeSecondaries: { keepAll: true } },
        },
      },
    ),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Module-internal libs — skip dla Vite HMR
    '@erp/MODULE_NAME/feature',
    '@erp/MODULE_NAME/data-access',
    '@erp/MODULE_NAME/ui',
    '@erp/MODULE_NAME/util',
    // Niewykorzystywane w runtime
    '@ng-web-apis/common',
    '@ng-web-apis/platform',
    '@ng-web-apis/screen-orientation',
    '@ng-web-apis/resize-observer',
    '@ng-web-apis/mutation-observer',
    '@taiga-ui/font-watcher',
    '@maskito/kit',
    'libphonenumber-js/core',
    '@maskito/phone',
    '@ng-web-apis/intersection-observer',
    '@jsverse/utils',
    '@softarc/native-federation/domain',
  ],

  features: {
    denseChunking: true
  }
});
```

> [!IMPORTANT]
> Zamień `MODULE_NAME` na faktyczną nazwę modułu (np. `catalog`, `dms`).

---

## Krok 2 — Przywrócenie manifestu remotów

Utwórz plik `frontend/apps/client/public/module-federation.manifest.json`:

```json
{
  "catalog": "http://localhost:4201/remoteEntry.json",
  "inventory": "http://localhost:4202/remoteEntry.json",
  "sales": "http://localhost:4203/remoteEntry.json",
  "dms": "http://localhost:4204/remoteEntry.json",
  "task-management": "http://localhost:4205/remoteEntry.json",
  "notification": "http://localhost:4206/remoteEntry.json"
}
```

> [!TIP]
> W produkcji zamień `http://localhost:PORT` na URL-e docelowych serwerów/CDN-ów.

---

## Krok 3 — Zmiana `main.ts` hosta

### Przed (monolit):
```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

### Po (Native Federation):
```ts
(window as any).ngDevMode = (window as any).ngDevMode || false;
import { initFederation } from '@angular-architects/native-federation';

initFederation('/module-federation.manifest.json')
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
```

Upewnij się, że `bootstrap.ts` istnieje w tym samym katalogu:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

---

## Krok 4 — Zmiana `main.ts` każdego remota

### Przed (monolit):
```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
```

### Po (Native Federation):
```ts
import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
```

Upewnij się, że `bootstrap.ts` w każdym remocie zawiera:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
```

---

## Krok 5 — Zmiana `STARTUP.ts` (ładowanie kontraktów z remotów zamiast importu)

### Przed (monolit) — bezpośrednie importy:
```ts
const CONTRACT_LOADERS: Record<string, () => Promise<any>> = {
  catalog: () => import('@erp/catalog/contract'),
  inventory: () => import('@erp/inventory/contract'),
  // ...
};

// Wywołanie:
const module = (await loader()) as EntryContractModule;
```

### Po (Native Federation) — `loadRemoteModule()`:
```ts
import { loadRemoteModule } from '@angular-architects/native-federation';

// Ładowanie kontraktu:
const module = (await loadRemoteModule({
  remoteName: config.routePrefix,
  exposedModule: './contract',
})) as EntryContractModule;
```

> [!IMPORTANT]
> W trybie Native Federation nie potrzebujesz mapy `CONTRACT_LOADERS`. Zamiast tego `loadRemoteModule()` dynamicznie pobiera ekspozycje z remotów poprzez manifest.

### Pełna wersja `STARTUP.ts` (Native Federation):

```ts
import { inject } from '@angular/core';
import { REMOTE_MODULES_CONFIG, RemoteModuleConfig } from '@erp/client/contract';
import { ErpNavRegistryService, ErpNavigationItem } from '@erp/shared/data-access';
import { ErpModalService } from '@erp/shared/ui';
import { ThemeService, LanguageService } from '@erp/client/util';
import { loadRemoteModule } from '@angular-architects/native-federation';

export async function STARTUP(): Promise<void> {
  const menuRegistry = inject(ErpNavRegistryService);
  const modalService = inject(ErpModalService);
  inject(ThemeService);
  inject(LanguageService);

  menuRegistry.register({
    id: 'dashbord',
    label: 'Home',
    iconId: 'home',
    route: 'dashbord',
  });

  const loadPromises = REMOTE_MODULES_CONFIG.map((config) =>
    loadContractFromRemote(config, modalService)
  );
  const remoteMenus = await Promise.all(loadPromises);

  for (const menu of remoteMenus) {
    if (menu) {
      menuRegistry.register(menu);
    }
  }
}

interface EntryContractModule {
  remoteMenu?: ErpNavigationItem[];
  remoteModalIds?: string[];
  remoteRoutes?: any[];
}

async function loadContractFromRemote(
  config: RemoteModuleConfig,
  modalService: ErpModalService,
): Promise<ErpNavigationItem | null> {
  try {
    const module = (await loadRemoteModule({
      remoteName: config.routePrefix,
      exposedModule: './contract',
    })) as EntryContractModule;

    if (module?.remoteModalIds) {
      modalService.registerModalIds(config.routePrefix, module.remoteModalIds);
    }

    if (module?.remoteMenu) {
      const prefixedMenu = applyRoutePrefixToMenu(module.remoteMenu, config.routePrefix);
      return {
        id: config.id,
        label: config.label,
        children: prefixedMenu,
      };
    }

    return null;
  } catch (error) {
    console.warn(`[MFE Gateway] Nie udało się załadować manifestu menu z ${config.id}.`, error);
    return {
      id: config.id,
      label: `${config.label} (nieaktywny)`,
      iconId: 'triangle-alert',
      disabled: true,
    };
  }
}

function applyRoutePrefixToMenu(items: ErpNavigationItem[], prefix: string): ErpNavigationItem[] {
  return items.map((item) => {
    const newItem = { ...item };
    if (newItem.route) {
      if (Array.isArray(newItem.route)) {
        newItem.route = [`/${prefix}`, ...newItem.route];
      } else {
        const cleanLink = newItem.route.startsWith('/') ? newItem.route.slice(1) : newItem.route;
        newItem.route = `/${prefix}/${cleanLink}`;
      }
    }
    if (newItem.children && Array.isArray(newItem.children)) {
      newItem.children = applyRoutePrefixToMenu(newItem.children as ErpNavigationItem[], prefix);
    }
    return newItem;
  });
}
```

---

## Krok 6 — Zmiana routingu (`app.routes.ts`)

### Przed (monolit) — bezpośrednie importy:
```ts
{
  path: 'catalog',
  loadChildren: () => import('@erp/catalog/contract').then((m) => m.remoteRoutes),
},
```

### Po (Native Federation) — `loadRemoteModule()`:
```ts
import { loadRemoteModule } from '@angular-architects/native-federation';

{
  path: 'catalog',
  loadChildren: () => loadRemoteModule({
    remoteName: 'catalog',
    exposedModule: './contract',
  }).then((m) => m.remoteRoutes),
},
```

Powtórz ten wzorzec dla **każdej** ścieżki modułu (`sales`, `inventory`, `dms`, `task-management`, `notification`).

---

## Krok 7 — Przywrócenie `project.json` (host + remoty)

Jest to **największa zmiana**. Każdy `project.json` musi przejść z czystego ESBuild na dwupoziomową konfigurację Native Federation.

### 7.1 Struktura targetów dla **hosta** (`frontend/apps/client/project.json`)

Zamień target `build` i `serve` na:

```json
{
  "targets": {
    "build": {
      "executor": "@angular-architects/native-federation:build",
      "options": { "cacheExternalArtifacts": true },
      "configurations": {
        "production": { "target": "client:esbuild:production" },
        "development": { "target": "client:esbuild:development", "dev": true }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "executor": "@angular-architects/native-federation:build",
      "options": {
        "target": "client:serve-original:development",
        "rebuildDelay": 500,
        "cacheExternalArtifacts": true,
        "dev": true,
        "devServer": true,
        "port": 0
      }
    },
    "esbuild": {
      "executor": "@angular/build:application",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/frontend/apps/client",
        "index": "frontend/apps/client/src/index.html",
        "tsConfig": "frontend/apps/client/tsconfig.app.json",
        "inlineStyleLanguage": "scss",
        "assets": [
          { "glob": "**/*", "input": "frontend/apps/client/public" },
          { "glob": "**/*", "input": "node_modules/@taiga-ui/icons/src", "output": "assets/taiga-ui/icons" }
        ],
        "styles": [
          "node_modules/@taiga-ui/styles/taiga-ui-fonts.less",
          "node_modules/@taiga-ui/styles/taiga-ui-theme.less",
          "frontend/apps/client/src/styles.css"
        ],
        "polyfills": ["es-module-shims"],
        "browser": "frontend/apps/client/src/main.ts"
      },
      "configurations": {
        "production": {
          "budgets": [
            { "type": "initial", "maximumWarning": "1mb", "maximumError": "2mb" },
            { "type": "anyComponentStyle", "maximumWarning": "4kb", "maximumError": "8kb" }
          ],
          "outputHashing": "all"
        },
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true
        }
      },
      "defaultConfiguration": "production"
    },
    "serve-original": {
      "continuous": true,
      "executor": "@nx/angular:dev-server",
      "options": {
        "port": 4200,
        "publicHost": "http://localhost:4200",
        "headers": {
          "Access-Control-Allow-Origin": "*"
        }
      },
      "configurations": {
        "production": { "buildTarget": "client:esbuild:production" },
        "development": { "buildTarget": "client:esbuild:development" }
      },
      "defaultConfiguration": "development"
    }
  }
}
```

> [!WARNING]
> Kluczowe różnice:
> - **`build`** deleguje do executora Native Federation, który opakowuje **`esbuild`**
> - **`serve`** deleguje do **`serve-original`** (czysty Angular dev server) opakowanego przez Native Federation
> - **`polyfills`** musi zawierać **`es-module-shims`** (wymagane przez Native Federation do import map)
> - **`serve-original`** wymaga nagłówka **`Access-Control-Allow-Origin: *`** do CORS między hostem a remotami

### 7.2 Struktura targetów dla **remota** (np. `catalog` na porcie 4201)

Wzorzec jest identyczny, z różnicami w `name`, `outputPath`, `port`:

```json
{
  "targets": {
    "build": {
      "executor": "@angular-architects/native-federation:build",
      "options": { "cacheExternalArtifacts": true },
      "configurations": {
        "production": { "target": "MODULE_NAME:esbuild:production" },
        "development": { "target": "MODULE_NAME:esbuild:development", "dev": true }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "executor": "@angular-architects/native-federation:build",
      "options": {
        "target": "MODULE_NAME:serve-original:development",
        "rebuildDelay": 500,
        "cacheExternalArtifacts": true,
        "dev": true,
        "devServer": true,
        "port": 0
      }
    },
    "esbuild": {
      "executor": "@angular/build:application",
      "options": {
        "outputPath": "dist/frontend/apps/modules/MODULE_NAME",
        "index": "frontend/apps/modules/MODULE_NAME/src/index.html",
        "tsConfig": "frontend/apps/modules/MODULE_NAME/tsconfig.app.json",
        "assets": [
          { "glob": "**/*", "input": "frontend/apps/modules/MODULE_NAME/public" },
          { "glob": "**/*", "input": "node_modules/@taiga-ui/icons/src", "output": "assets/taiga-ui/icons" }
        ],
        "styles": [
          "node_modules/@taiga-ui/styles/taiga-ui-fonts.less",
          "node_modules/@taiga-ui/styles/taiga-ui-theme.less",
          "frontend/apps/modules/MODULE_NAME/src/styles.css"
        ],
        "polyfills": ["es-module-shims"],
        "browser": "frontend/apps/modules/MODULE_NAME/src/main.ts"
      }
    },
    "serve-original": {
      "continuous": true,
      "executor": "@nx/angular:dev-server",
      "options": {
        "port": PORT,
        "publicHost": "http://localhost:PORT",
        "headers": { "Access-Control-Allow-Origin": "*" }
      },
      "configurations": {
        "production": { "buildTarget": "MODULE_NAME:esbuild:production" },
        "development": { "buildTarget": "MODULE_NAME:esbuild:development" }
      },
      "defaultConfiguration": "development"
    }
  }
}
```

**Porty remotów:**

| Moduł | Port |
|-------|------|
| `catalog` | 4201 |
| `inventory` | 4202 |
| `sales` | 4203 |
| `dms` | 4204 |
| `task-management` | 4205 |
| `notification` | 4206 |

---

## Krok 8 — Odchudź `tsconfig.app.json` hosta

W monolicie host wymaga jawnych ścieżek do **wszystkich** bibliotek modułów w sekcji `include`. W trybie MFE te biblioteki są ładowane dynamicznie przez Native Federation — **nie trzeba ich jawnie inkludować**.

### Przed (monolit) — rozszerzone include:
```json
{
  "include": [
    "src/**/*.ts",
    "../../libs/client/contract/src/index.ts",
    "../../libs/shared/ui/src/index.ts",
    "../../libs/client/util/src/index.ts",
    "../../libs/shared/auth/src/index.ts",
    "../../libs/client/feature/src/index.ts",
    "../../libs/shared/data-access/src/index.ts",
    "../../libs/client/ui/src/index.ts",
    "../../libs/modules/catalog/contract/src/index.ts",
    "../../libs/modules/catalog/feature/src/index.ts",
    "../../libs/modules/catalog/ui/src/index.ts",
    "../../libs/modules/catalog/util/src/index.ts",
    "... (wszystkie moduły)"
  ]
}
```

### Po (Native Federation) — tylko host-specific:
```json
{
  "include": [
    "src/**/*.ts",
    "../../libs/client/contract/src/index.ts",
    "../../libs/shared/ui/src/index.ts",
    "../../libs/client/util/src/index.ts",
    "../../libs/shared/auth/src/index.ts",
    "../../libs/client/feature/src/index.ts",
    "../../libs/shared/data-access/src/index.ts",
    "../../libs/client/ui/src/index.ts",
    "../../libs/modules/catalog/data-access/src/index.ts",
    "../../libs/modules/notification/data-access/src/index.ts"
  ]
}
```

> [!NOTE]
> Biblioteki `@erp/MODULE/contract`, `@erp/MODULE/feature`, `@erp/MODULE/ui`, `@erp/MODULE/util` zostaną rozwiązane przez Native Federation w runtime — host ich nie bundluje.

---

## Krok 9 — Uruchomienie i weryfikacja

### 9.1 Uruchom remoty i hosta osobno

```bash
# Terminal 1 — Host
pnpm nx run client:serve

# Terminal 2 — Catalog remote
pnpm nx run catalog:serve

# Terminal 3 — Inventory remote
pnpm nx run inventory:serve

# ... (analogicznie dla pozostałych)
```

### 9.2 Weryfikacja
1. Otwórz `http://localhost:4200`
2. Sprawdź konsolę przeglądarki — brak błędów CORS lub brakujących `remoteEntry.json`
3. Przejdź do każdego modułu (np. `/catalog`, `/sales`) — trasy powinny się ładować leniwie z remotów
4. Sprawdź Network → każdy moduł powinien pobierać `remoteEntry.json` ze swojego portu
5. Zweryfikuj, że menu ładuje się dynamicznie (STARTUP łączy się z remotami)

---

## Podsumowanie zmian

| Plik / Katalog | Monolit (obecny stan) | Native Federation (docelowy) |
|---|---|---|
| `main.ts` (host) | Bezpośredni `bootstrapApplication()` | `initFederation()` → dynamic `import('./bootstrap')` |
| `main.ts` (remoty) | Bezpośredni `bootstrapApplication()` | `initFederation()` → dynamic `import('./bootstrap')` |
| `STARTUP.ts` | `import('@erp/MODULE/contract')` | `loadRemoteModule({ remoteName, exposedModule })` |
| `app.routes.ts` | `import('@erp/MODULE/contract').then(m => m.remoteRoutes)` | `loadRemoteModule({ remoteName, exposedModule }).then(m => m.remoteRoutes)` |
| `project.json` (host) | `@angular/build:application` + `@angular-devkit/build-angular:dev-server` | `@angular-architects/native-federation:build` → `esbuild` + `serve-original` |
| `project.json` (remoty) | j.w. | j.w. (+ `port` + `publicHost` + CORS) |
| `federation.config.mjs` | ❌ usunięty | ✅ wymagany (host + każdy remote) |
| `module-federation.manifest.json` | ❌ usunięty | ✅ wymagany |
| `tsconfig.app.json` (host) | Include **wszystkich** bibliotek modułów | Include tylko host-specific libs |
| `polyfills` | brak | `es-module-shims` |
| `bootstrap.ts` | niepotrzebny (wbudowany w `main.ts`) | wymagany (osobny plik) |

> [!CAUTION]
> **Nie zmieniaj kodu komponentów, serwisów, szablonów HTML ani struktury bibliotek (`libs/`)!** Cała migracja polega wyłącznie na zmianach w plikach konfiguracyjnych i entrypoint'ach aplikacji.

