---
trigger: manual
---

# Przepis: Nowy moduł — Część 1: Generacja i konfiguracja aplikacji (Architektura Hybrydowa Monolit / MFE)

> **Część 2**: `nowy-modul-2-integracja.md` — pliki bibliotek, tłumaczenia Transloco, rejestracja w Client (module-loaders, manifest, routing), ESLint, tsconfig, weryfikacja.

## Parametry wejściowe

| Parametr | Wymagany | Opis |
|----------|----------|------|
| `MODULE_NAME` | ✅ | Nazwa modułu w **kebab-case** (np. `warehouse`, `hr-management`) |
| `MODULE_LABEL` | ✅ | Wyświetlana nazwa modułu po polsku (np. `Magazyn`, `HR`) |
| `PORT` | ❌ | Port dev-servera. Jeśli nie podany — **znajdź najwyższy zajęty port** we wszystkich plikach `frontend/apps/modules/*/project.json` (szukaj `"port"` w target `serve`) i przypisz `najwyższy + 1`. Client: `4200`, moduły od `4201`. |

## Konwencje nazewnicze

| Element | Wzorzec | Przykład (`warehouse`) |
|---------|---------|-----|
| Scope tag | `scope:MODULE_NAME` | `scope:warehouse` |
| Alias TS | `@erp/MODULE_NAME/*` | `@erp/warehouse/feature` |
| App path | `frontend/apps/modules/MODULE_NAME` | `frontend/apps/modules/warehouse` |
| Lib path | `frontend/libs/modules/MODULE_NAME` | `frontend/libs/modules/warehouse` |
| Selektor entry | `erp-MODULE_NAME-entry` | `erp-warehouse-entry` |
| Klasa entry | `AppComponent` | `AppComponent` |

---

## Krok 1: Wygeneruj biblioteki (5 warstw)

Generuj z katalogu **root workspace** (tam gdzie `nx.json`). Każdy moduł składa się z 5 bibliotek, a zależności między nimi są wymuszane przez ESLint (`@nx/enforce-module-boundaries`):

```bash
# 1. Contract (routing, menu, modale — eksponowane przez Native Federation)
npx nx generate @nx/angular:library \
  --name=contract \
  --directory=frontend/libs/modules/MODULE_NAME/contract \
  --tags="scope:MODULE_NAME,type:contract" \
  --prefix=erp --standalone --skipModule --no-interactive

# 2. Feature (smart components, logika biznesowa, definicje modali)
npx nx generate @nx/angular:library \
  --name=feature \
  --directory=frontend/libs/modules/MODULE_NAME/feature \
  --tags="scope:MODULE_NAME,type:feature" \
  --prefix=erp --standalone --skipModule --no-interactive

# 3. UI (prezentacyjne / dumb components Taiga UI)
npx nx generate @nx/angular:library \
  --name=ui \
  --directory=frontend/libs/modules/MODULE_NAME/ui \
  --tags="scope:MODULE_NAME,type:ui" \
  --prefix=erp --standalone --skipModule --no-interactive

# 4. Data-Access (serwisy HTTP API Clients, Signal Stores)
npx nx generate @nx/angular:library \
  --name=data-access \
  --directory=frontend/libs/modules/MODULE_NAME/data-access \
  --tags="scope:MODULE_NAME,type:data-access" \
  --prefix=erp --standalone --skipModule --no-interactive

# 5. Util (funkcje pomocnicze, interfejsy, modele widokowe, stałe)
npx nx generate @nx/angular:library \
  --name=util \
  --directory=frontend/libs/modules/MODULE_NAME/util \
  --tags="scope:MODULE_NAME,type:util" \
  --prefix=erp --standalone --skipModule --no-interactive
```

> **UWAGA**: Sprawdź `project.json` każdej wygenerowanej biblioteki — pole `name` powinno mieć format `MODULE_NAME-WARSTWA` (np. `warehouse-feature`). Popraw ręcznie, jeśli generator nadał inną nazwę.

---

## Krok 2: Wygeneruj aplikację (MFE Remote)

```bash
npx nx generate @nx/angular:remote \
  --name=MODULE_NAME \
  --directory=frontend/apps/modules/MODULE_NAME \
  --host=client --port=PORT \
  --tags="scope:MODULE_NAME,type:app" \
  --prefix=app --standalone --no-interactive
```

### Krok 2.1: Czyszczenie kodu boilerplate i e2e

Generator `@nx/angular:remote` tworzy nieużywane lokalne pliki routingu i e2e. Ponieważ cała logika modułu jest przechowywana w dedykowanych bibliotekach (`contract`, `feature` itp.), musisz je usunąć:

```bash
# 1. Usuń wygenerowany projekt e2e (nieużywany w monorepo)
rm -rf frontend/apps/modules/MODULE_NAME-e2e

# 2. Usuń lokalne pliki routingu i komponentów remote-entry z aplikacji
rm -rf frontend/apps/modules/MODULE_NAME/src/app/app.routes.ts \
       frontend/apps/modules/MODULE_NAME/src/app/remote-entry

# 3. Usuń pliki konfiguracyjne Webpack Module Federation (używamy Native Federation)
rm -f frontend/apps/modules/MODULE_NAME/module-federation.config.ts \
      frontend/apps/modules/MODULE_NAME/webpack.config.ts \
      frontend/apps/modules/MODULE_NAME/webpack.prod.config.ts
```

---

## Krok 3: Skonfiguruj pliki aplikacji

W naszej hybrydowej architekturze aplikacja remote musi obsługiwać zarówno bezpośrednie serwowanie w trybie **Monolitu na dev (`development`)** jak i serwowanie jako niezależne **Mikrofrontendy (`production` / `mfe`)**.

Dostosuj pliki w `frontend/apps/modules/MODULE_NAME/`:

### 3.1 `project.json` ⭐ Targety Hybrydowe (`build`, `serve`, `serve-mfe`, `esbuild`, `serve-original`)

Kluczowe elementy konfiguracji:
- `"name"` = `"MODULE_NAME"`, `"tags"` = `["scope:MODULE_NAME", "type:app"]`
- Target `"build"`: używa `@angular-architects/native-federation:build` (`production` / `mfe`).
- Target `"serve"`: używa `@angular-devkit/build-angular:dev-server` z `buildTarget: "MODULE_NAME:esbuild:development"` (czysty dev-server monolitu/standalone na porcie `PORT` z nagłówkami CORS).
- Target `"serve-mfe"`: używa `nx:run-commands` do równoległego uruchomienia remota (`MODULE_NAME:serve-mfe-remote`) oraz hosta (`client:serve-mfe`).
- Target `"serve-mfe-remote"`: używa `@angular-architects/native-federation:build` z `target: "MODULE_NAME:serve-original:mfe"` (serwowanie remota w trybie mikrofrontendu na porcie `PORT`).
- Target `"esbuild"`: czysty `@angular/build:application`. W konfiguracjach `production` oraz `mfe` zawiera sekcję `"fileReplacements"` podmieniającą wejście na `main.mfe.ts`.
- Target `"serve-original"`: `@nx/angular:dev-server` na porcie `PORT` z nagłówkami CORS (`Access-Control-Allow-Origin: *`).

Wzorcowy `project.json`:

```json
{
  "name": "MODULE_NAME",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "prefix": "app",
  "sourceRoot": "frontend/apps/modules/MODULE_NAME/src",
  "tags": ["scope:MODULE_NAME", "type:app"],
  "targets": {
    "build": {
      "metadata": {
        "description": "PRODUKCJA/MFE: Buduje moduł z użyciem Native Federation (generuje remoteEntry.json i manifest)"
      },
      "executor": "@angular-architects/native-federation:build",
      "options": { "cacheExternalArtifacts": true },
      "configurations": {
        "production": { "target": "MODULE_NAME:esbuild:production" },
        "development": { "target": "MODULE_NAME:esbuild:development", "dev": true },
        "mfe": { "target": "MODULE_NAME:esbuild:mfe", "dev": true }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "metadata": {
        "description": "MONOLIT (DEV): Uruchamia remote jako zwykłą aplikację na porcie modułu (bez Native Federation)"
      },
      "continuous": true,
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "port": PORT,
        "publicHost": "http://localhost:PORT",
        "headers": {
          "Access-Control-Allow-Origin": "*"
        }
      },
      "configurations": {
        "production": { "buildTarget": "MODULE_NAME:build:production" },
        "development": { "buildTarget": "MODULE_NAME:esbuild:development" }
      },
      "defaultConfiguration": "development"
    },
    "serve-mfe": {
      "metadata": {
        "description": "Uruchamia równolegle ten remote (MFE) oraz hosta (client)"
      },
      "executor": "nx:run-commands",
      "options": {
        "commands": [
          "nx run MODULE_NAME:serve-mfe-remote",
          "nx run client:serve-mfe"
        ],
        "parallel": true
      }
    },
    "serve-mfe-remote": {
      "metadata": {
        "description": "Uruchamia wyłącznie ten remote jako mikrofrontend (bez hosta)"
      },
      "executor": "@angular-architects/native-federation:build",
      "options": {
        "target": "MODULE_NAME:serve-original:mfe",
        "rebuildDelay": 500,
        "cacheExternalArtifacts": true,
        "dev": true,
        "devServer": true,
        "port": PORT
      }
    },
    "esbuild": {
      "metadata": {
        "description": "DEV/MONOLIT BUILD: Buduje moduł natywnym esbuildem jako monolityczną aplikację Angular (bez federacji)"
      },
      "executor": "@angular/build:application",
      "outputs": ["{options.outputPath}"],
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
      },
      "configurations": {
        "production": {
          "budgets": [
            { "type": "initial", "maximumWarning": "1mb", "maximumError": "2mb" },
            { "type": "anyComponentStyle", "maximumWarning": "4kb", "maximumError": "8kb" }
          ],
          "outputHashing": "all",
          "fileReplacements": [
            {
              "replace": "frontend/apps/modules/MODULE_NAME/src/main.ts",
              "with": "frontend/apps/modules/MODULE_NAME/src/main.mfe.ts"
            }
          ]
        },
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true,
          "namedChunks": true
        },
        "mfe": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true,
          "namedChunks": true,
          "fileReplacements": [
            {
              "replace": "frontend/apps/modules/MODULE_NAME/src/main.ts",
              "with": "frontend/apps/modules/MODULE_NAME/src/main.mfe.ts"
            }
          ]
        }
      },
      "defaultConfiguration": "production"
    },
    "serve-original": {
      "metadata": {
        "description": "DEV SERVER (WEWNĘTRZNY): Standardowy serwer deweloperski Angular używany pod spodem przez Native Federation do serwowania remota"
      },
      "continuous": true,
      "executor": "@nx/angular:dev-server",
      "options": {
        "port": PORT,
        "publicHost": "http://localhost:PORT",
        "headers": {
          "Access-Control-Allow-Origin": "*"
        }
      },
      "configurations": {
        "production": { "buildTarget": "MODULE_NAME:esbuild:production" },
        "development": { "buildTarget": "MODULE_NAME:esbuild:development" },
        "mfe": { "buildTarget": "MODULE_NAME:esbuild:mfe" }
      },
      "defaultConfiguration": "development"
    },
    "extract-i18n": {
      "executor": "@angular-devkit/build-angular:extract-i18n",
      "options": {
        "buildTarget": "MODULE_NAME:build"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint"
    },
    "test": {
      "executor": "@nx/vitest:test",
      "outputs": ["{options.reportsDirectory}"],
      "options": {
        "reportsDirectory": "../../../../coverage/frontend/apps/modules/MODULE_NAME"
      }
    }
  }
}
```

### 3.2 `federation.config.mjs` ⭐ Native Federation z zachowaniem Vite HMR

Używamy **Native Federation** (`@angular-architects/native-federation`). Plik `federation.config.mjs` eksponuje wyłącznie punkt wejściowy biblioteki `contract` (`./contract`).

> **WAŻNE — Vite HMR**: Wewnętrzne biblioteki modułu (`@erp/MODULE_NAME/feature`, `data-access`, `ui`, `util`) **muszą** być umieszczone w tablicy `skip`. Bez tego `shareAll()` rejestruje je jako shared modules — Native Federation pre-bundluje je do zewnętrznych chunków, które nie podlegają odświeżaniu Vite HMR na dev-serwerze bez restartu.

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
    // Skip module-internal libs so they are bundled inline and support Vite HMR
    '@erp/MODULE_NAME/feature',
    '@erp/MODULE_NAME/data-access',
    '@erp/MODULE_NAME/ui',
    '@erp/MODULE_NAME/util',
    // Skip external libs not shared at runtime
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
    denseChunking: true,
  }
});
```

### 3.3 `src/main.ts` (Monolit DEV) oraz `src/main.mfe.ts` (Mikrofrontend PROD/MFE) ⭐ Podwójny punkt wejściowy

W systemie hybrydowym utrzymujemy dwa wejścia do aplikacji:

#### `src/main.ts` — używany w trybie Monolitu (domyślny `development`)
Nie ładuje manifestu ani nie inicjalizuje Native Federation. Bezpośrednio wywołuje `bootstrap.ts`:

```ts
import('./bootstrap').catch((err) => console.error(err));
```

#### `src/main.mfe.ts` — używany w trybie Mikrofrontendów (`production` / `mfe` via `fileReplacements`)
Inicjalizuje `initFederation()` bez argumentu (ponieważ remote serwuje jedynie `remoteEntry.json` i nie potrzebuje manifestu):

```ts
((window as unknown) as Record<string, unknown>)['ngDevMode'] =
  ((window as unknown) as Record<string, unknown>)['ngDevMode'] ?? false;
import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .then(() => import('./bootstrap'))
  .catch((err: unknown) => console.error(err));
```

### 3.4 `src/bootstrap.ts`

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
```

### 3.5 `src/app/app.component.ts`

Lokalny komponent `AppComponent` służący jako opakowanie dla widoków standalone w `<tui-root>`:

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';

@Component({
  selector: 'erp-MODULE_NAME-entry',
  standalone: true,
  imports: [RouterOutlet, TuiRoot],
  template: `
    <tui-root>
      <router-outlet></router-outlet>
    </tui-root>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
    }
  `],
})
export class AppComponent {}
```

### 3.6 `src/app/app.config.ts`

Używamy dostawcy `provideRemoteDevSupport()` z `@erp/shared/ui` do automatycznej konfiguracji podstawowych usług (Transloco, HttpClient, Taiga UI) oraz automatycznej rejestracji modali modułu w `ErpModalService` przy samodzielnym uruchomieniu remota:

```ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes } from '@erp/MODULE_NAME/contract';
import { API_BASE_URL } from '@erp/MODULE_NAME/data-access';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'MODULE_NAME',
      contractLoader: () => import('@erp/MODULE_NAME/contract'),
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    { provide: API_BASE_URL, useValue: 'http://localhost:BACKEND_PORT' }, // Zmień BACKEND_PORT na port BFF modułu (np. 5250)
  ],
};
```

### 3.7 `src/styles.css`

```css
/* Reset domyślnych marginesów i pełna wysokość dla tui-root */
html,
body,
erp-MODULE_NAME-entry,
tui-root {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  display: block;
}
```

### 3.8 `src/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>MODULE_NAME</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
  <body>
    <erp-MODULE_NAME-entry></erp-MODULE_NAME-entry>
  </body>
</html>
```

### 3.9 `eslint.config.mjs` (w katalogu aplikacji)

```js
import nx from '@nx/eslint-plugin';
import baseConfig from '../../../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
    },
  },
  { files: ['**/*.html'], rules: {} },
];
```

### 3.10 `tsconfig.app.json`

Ponieważ usunęliśmy wygenerowane pliki routingu i remote-entry, wyczyść pole `"files"` i dostosuj wersję standardu ES (`"es2022"`):

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "types": ["node"],
    "target": "es2022"
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "vite.config.ts",
    "vite.config.mts",
    "vitest.config.ts",
    "vitest.config.mts",
    "src/**/*.test.tsx",
    "src/**/*.spec.tsx",
    "src/**/*.test.js",
    "src/**/*.spec.js",
    "src/**/*.test.jsx",
    "src/**/*.spec.jsx",
    "src/test-setup.ts"
  ],
  "files": []
}
```

---

**→ Przejdź do `nowy-modul-2-integracja.md`** — kroki 4–8 (uzupełnienie bibliotek, tłumaczenia Transloco, rejestracja w Client i testy).
