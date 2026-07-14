---
trigger: manual
---

# Przepis: Nowy moduł — Część 1: Generacja i konfiguracja aplikacji

> **Część 2**: `nowy-modul-2-integracja.md` — pliki bibliotek, rejestracja w Client, ESLint, tsconfig, weryfikacja.

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
| Klasa entry | `RemoteEntry` | `RemoteEntry` |

---

## Krok 1: Wygeneruj biblioteki (5 warstw)

Generuj z katalogu **root workspace** (tam gdzie `nx.json`). Każdy moduł ma 5 bibliotek:

```bash
# 1. Contract
npx nx generate @nx/angular:library \
  --name=contract \
  --directory=frontend/libs/modules/MODULE_NAME/contract \
  --tags="scope:MODULE_NAME,type:contract" \
  --prefix=erp --standalone --skipModule --no-interactive

# 2. Feature
npx nx generate @nx/angular:library \
  --name=feature \
  --directory=frontend/libs/modules/MODULE_NAME/feature \
  --tags="scope:MODULE_NAME,type:feature" \
  --prefix=erp --standalone --skipModule --no-interactive

# 3. UI
npx nx generate @nx/angular:library \
  --name=ui \
  --directory=frontend/libs/modules/MODULE_NAME/ui \
  --tags="scope:MODULE_NAME,type:ui" \
  --prefix=erp --standalone --skipModule --no-interactive

# 4. Data-Access
npx nx generate @nx/angular:library \
  --name=data-access \
  --directory=frontend/libs/modules/MODULE_NAME/data-access \
  --tags="scope:MODULE_NAME,type:data-access" \
  --prefix=erp --standalone --skipModule --no-interactive

# 5. Util
npx nx generate @nx/angular:library \
  --name=util \
  --directory=frontend/libs/modules/MODULE_NAME/util \
  --tags="scope:MODULE_NAME,type:util" \
  --prefix=erp --standalone --skipModule --no-interactive
```

> **UWAGA**: Sprawdź `project.json` każdej biblioteki — `name` powinno być `MODULE_NAME-WARSTWA` (np. `warehouse-feature`). Popraw ręcznie jeśli trzeba.

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

> Jeśli `@nx/angular:remote` nie działa — wygeneruj zwykłą aplikację i skonfiguruj MF ręcznie (Krok 3).

### Krok 2.1: Czyszczenie kodu boilerplate i e2e

Generator `@nx/angular:remote` tworzy nieużywane lokalne pliki routingu i e2e. Ponieważ cała logika modułu jest przechowywana w dedykowanych bibliotekach (`contract`, `feature` itp.), musisz je usunąć, aby zachować czystość repozytorium:

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

Sprawdź i dostosuj pliki w `frontend/apps/modules/MODULE_NAME/`:

### 3.1 `project.json`

Kluczowe pola do zweryfikowania:
- `"name"` = `"MODULE_NAME"`, `"tags"` = `["scope:MODULE_NAME", "type:app"]`
- W target `serve`: `"target"` = `"MODULE_NAME:serve-original:development"`, `"port"` = `0` (port jest ustawiany w `serve-original`)
- W target `serve-original`: `"port"` = `PORT`, `"publicHost"` = `"http://localhost:PORT"`
- W target `esbuild`: `"outputPath"` = `"dist/frontend/apps/modules/MODULE_NAME"`
- Executor build: `"executor"` = `"@angular-architects/native-federation:build"`
- **Ustawienia Budżetów**: Zwiększ limity budżetów w konfiguracji `production`:
  ```json
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "1mb",
      "maximumError": "2mb"
    },
    ...
  ]
  ```

Wzorcowy `project.json` (skopiuj i dostosuj z innego modułu, np. `catalog`):

```json
{
  "name": "MODULE_NAME",
  "projectType": "application",
  "prefix": "app",
  "sourceRoot": "frontend/apps/modules/MODULE_NAME/src",
  "tags": ["scope:MODULE_NAME", "type:app"],
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
          "outputHashing": "all"
        },
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true,
          "namedChunks": true
        }
      },
      "defaultConfiguration": "production"
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

### 3.2 `federation.config.mjs` ⭐ Native Federation

> **WAŻNE**: Używamy **Native Federation** (`@angular-architects/native-federation`), a nie Webpack Module Federation. Plik `federation.config.mjs` zastępuje `module-federation.config.ts`.

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

### 3.3 `src/main.ts` ⭐ Native Federation

```ts
import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
```

> **UWAGA**: Remote nie podaje URL manifestu — wywołuje `initFederation()` bez argumentu. Manifest (`/module-federation.manifest.json`) jest używany tylko przez **host** (`client`).

### 3.4 `src/bootstrap.ts`

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
```

### 3.5 `src/app/app.component.ts`

Stwórz lokalny komponent `AppComponent` służący jako opakowanie dla widoków standalone w `<tui-root>` (wymagany przez Taiga UI):

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

Używamy dostawcy `provideRemoteDevSupport()` z `@erp/shared/ui` do automatycznego zarejestrowania wymaganych paczek (Transloco, HttpClient, Taiga UI) w trybie standalone:

```ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes } from '@erp/MODULE_NAME/contract';
import { API_BASE_URL } from '@erp/MODULE_NAME/data-access';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    { provide: API_BASE_URL, useValue: 'http://localhost:BACKEND_PORT' }, // Zmień BACKEND_PORT na port BFF modułu (np. 5250)
  ],
};
```

### 3.7 `src/styles.css`

Zresetuj marginesy oraz dodaj pełną wysokość, aby tui-root oraz strona standalone zajmowały cały ekran:

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

### 3.9 `eslint.config.mjs` (aplikacja — prefix `app`, import z `../../../../eslint.config.mjs`)

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

Ponieważ usunęliśmy wygenerowany plik `entry.routes.ts` z katalogu `remote-entry`, musisz wyczyścić pole `"files"` w konfiguracji tsconfig aplikacji i dostosować wersję docelową standardu ES (`"es2022"`):

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

**→ Przejdź do `nowy-modul-2-integracja.md`** — kroki 4–8.
