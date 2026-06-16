# Przepis: Tworzenie nowego modułu frontendowego

## Parametry wejściowe

| Parametr | Wymagany | Opis |
|----------|----------|------|
| `MODULE_NAME` | ✅ | Nazwa modułu w **kebab-case** (np. `warehouse`, `hr-management`) |
| `MODULE_LABEL` | ✅ | Wyświetlana nazwa modułu po polsku (np. `Magazyn`, `HR`) |
| `PORT` | ❌ | Port dev-servera. Jeśli nie podany — **znajdź najwyższy zajęty port** we wszystkich plikach `frontend/apps/modules/*/project.json` (szukaj klucza `"port"` w target `serve`) i przypisz `najwyższy + 1`. Client używa portu `4200`, więc moduły zaczynają od `4201`. |

## Konwencje nazewnicze

Dla modułu o nazwie `MODULE_NAME`:

| Element | Wzorzec | Przykład (MODULE_NAME=`warehouse`) |
|---------|---------|-----|
| Scope tag | `scope:MODULE_NAME` | `scope:warehouse` |
| Alias TS | `@erp/MODULE_NAME/*` | `@erp/warehouse/feature` |
| App path | `frontend/apps/modules/MODULE_NAME` | `frontend/apps/modules/warehouse` |
| Lib path | `frontend/libs/modules/MODULE_NAME` | `frontend/libs/modules/warehouse` |
| Selektor entry | `erp-MODULE_NAME-entry` | `erp-warehouse-entry` |
| Klasa entry | `RemoteEntry` | `RemoteEntry` |

---

## Krok 1: Wygeneruj biblioteki (5 warstw)

Każdy moduł ma **5 bibliotek** w `frontend/libs/modules/MODULE_NAME/`. Generuj je komendami NX z katalogu **root workspace** (tam gdzie `nx.json`):

### 1.1 Contract

```bash
npx nx generate @nx/angular:library \
  --name=contract \
  --directory=frontend/libs/modules/MODULE_NAME/contract \
  --tags="scope:MODULE_NAME,type:contract" \
  --prefix=erp \
  --standalone \
  --skipModule \
  --no-interactive
```

### 1.2 Feature

```bash
npx nx generate @nx/angular:library \
  --name=feature \
  --directory=frontend/libs/modules/MODULE_NAME/feature \
  --tags="scope:MODULE_NAME,type:feature" \
  --prefix=erp \
  --standalone \
  --skipModule \
  --no-interactive
```

### 1.3 UI

```bash
npx nx generate @nx/angular:library \
  --name=ui \
  --directory=frontend/libs/modules/MODULE_NAME/ui \
  --tags="scope:MODULE_NAME,type:ui" \
  --prefix=erp \
  --standalone \
  --skipModule \
  --no-interactive
```

### 1.4 Data-Access

```bash
npx nx generate @nx/angular:library \
  --name=data-access \
  --directory=frontend/libs/modules/MODULE_NAME/data-access \
  --tags="scope:MODULE_NAME,type:data-access" \
  --prefix=erp \
  --standalone \
  --skipModule \
  --no-interactive
```

### 1.5 Util

```bash
npx nx generate @nx/angular:library \
  --name=util \
  --directory=frontend/libs/modules/MODULE_NAME/util \
  --tags="scope:MODULE_NAME,type:util" \
  --prefix=erp \
  --standalone \
  --skipModule \
  --no-interactive
```

> **UWAGA**: Po wygenerowaniu sprawdź czy w każdym `project.json` tagi (`tags`) i nazwy (`name`) zostały ustawione poprawnie. Wzorzec nazwy projektu: `MODULE_NAME-WARSTWA` (np. `warehouse-feature`, `warehouse-contract`). Jeśli generator ustawił inną nazwę — **popraw ręcznie**.

---

## Krok 2: Wygeneruj aplikację (MFE Remote)

```bash
npx nx generate @nx/angular:remote \
  --name=MODULE_NAME \
  --directory=frontend/apps/modules/MODULE_NAME \
  --host=client \
  --port=PORT \
  --tags="scope:MODULE_NAME,type:app" \
  --prefix=app \
  --standalone \
  --no-interactive
```

> **UWAGA**: Jeśli generator `@nx/angular:remote` nie jest dostępny lub generuje błędy, alternatywnie wygeneruj zwykłą aplikację i ręcznie skonfiguruj Module Federation (patrz Krok 3).

---

## Krok 3: Skonfiguruj pliki aplikacji

Po wygenerowaniu sprawdź i dostosuj pliki w `frontend/apps/modules/MODULE_NAME/`:

### 3.1 `project.json`

Upewnij się, że:
- `"name"` = `"MODULE_NAME"`
- `"tags"` = `["scope:MODULE_NAME", "type:app"]`
- `"prefix"` = `"app"`
- Target `serve` ma:
  - `"executor": "@nx/angular:dev-server"`
  - `"port": PORT`
  - `"publicHost": "http://localhost:PORT"`
  - `"dependsOn": ["client:serve"]`
- Target `serve-static` ma ten sam `PORT`
- Target `build` ma `"customWebpackConfig"` wskazujący na `webpack.config.ts`
- Konfiguracja `production` ma `"customWebpackConfig"` wskazujący na `webpack.prod.config.ts`

Wzorzec (na podstawie `catalog`):

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
      "executor": "@nx/angular:webpack-browser",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/frontend/apps/modules/MODULE_NAME",
        "index": "frontend/apps/modules/MODULE_NAME/src/index.html",
        "main": "frontend/apps/modules/MODULE_NAME/src/main.ts",
        "tsConfig": "frontend/apps/modules/MODULE_NAME/tsconfig.app.json",
        "assets": [
          {
            "glob": "**/*",
            "input": "frontend/apps/modules/MODULE_NAME/public"
          }
        ],
        "styles": ["frontend/apps/modules/MODULE_NAME/src/styles.css"],
        "customWebpackConfig": {
          "path": "frontend/apps/modules/MODULE_NAME/webpack.config.ts"
        }
      },
      "configurations": {
        "production": {
          "budgets": [
            { "type": "initial", "maximumWarning": "500kb", "maximumError": "1mb" },
            { "type": "anyComponentStyle", "maximumWarning": "4kb", "maximumError": "8kb" }
          ],
          "outputHashing": "all",
          "customWebpackConfig": {
            "path": "frontend/apps/modules/MODULE_NAME/webpack.prod.config.ts"
          }
        },
        "development": {
          "buildOptimizer": false,
          "optimization": false,
          "vendorChunk": true,
          "extractLicenses": false,
          "sourceMap": true,
          "namedChunks": true
        }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "continuous": true,
      "executor": "@nx/angular:dev-server",
      "options": {
        "port": PORT,
        "publicHost": "http://localhost:PORT"
      },
      "configurations": {
        "production": { "buildTarget": "MODULE_NAME:build:production" },
        "development": { "buildTarget": "MODULE_NAME:build:development" }
      },
      "defaultConfiguration": "development",
      "dependsOn": ["client:serve"]
    },
    "extract-i18n": {
      "executor": "@angular-devkit/build-angular:extract-i18n",
      "options": { "buildTarget": "MODULE_NAME:build" }
    },
    "lint": { "executor": "@nx/eslint:lint" },
    "test": {
      "executor": "@nx/vitest:test",
      "outputs": ["{options.reportsDirectory}"],
      "options": {
        "reportsDirectory": "../../../../coverage/frontend/apps/modules/MODULE_NAME"
      }
    },
    "serve-static": {
      "continuous": true,
      "executor": "@nx/web:file-server",
      "defaultConfiguration": "production",
      "options": {
        "buildTarget": "MODULE_NAME:build",
        "port": PORT,
        "watch": false
      },
      "configurations": {
        "development": { "buildTarget": "MODULE_NAME:build:development" },
        "production": { "buildTarget": "MODULE_NAME:build:production" }
      }
    }
  }
}
```

### 3.2 `module-federation.config.ts`

```ts
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'MODULE_NAME',
  exposes: {
    './contract': 'frontend/libs/modules/MODULE_NAME/contract/src/index.ts',
  },
};

/**
 * Nx requires a default export of the config to allow correct resolution of the module federation graph.
 **/
export default config;
```

### 3.3 `webpack.config.ts`

```ts
import { withModuleFederation } from '@nx/module-federation/angular';
import { createModuleFederationConfig } from '../../module-federation.shared';
import config from './module-federation.config';

/**
 * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support for Module Federation
 * The DTS Plugin can be enabled by setting dts: true
 * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
 */
export default withModuleFederation(createModuleFederationConfig(config), { dts: false });
```

### 3.4 `webpack.prod.config.ts`

```ts
import { withModuleFederation } from '@nx/module-federation/angular';
import { createModuleFederationConfig } from '../../module-federation.shared';
import config from './module-federation.config';

/**
 * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support for Module Federation
 * The DTS Plugin can be enabled by setting dts: true
 * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
 */
export default withModuleFederation(
  createModuleFederationConfig({
    ...config,
    /*
     * Remote overrides for production.
     * Each entry is a pair of a unique name and the URL where it is deployed.
     *
     * e.g.
     * remotes: [
     *   ['app1', 'https://app1.example.com'],
     *   ['app2', 'https://app2.example.com'],
     * ]
     */
  }),
  { dts: false },
);
```

### 3.5 `src/main.ts`

```ts
import('./bootstrap').catch((err) => console.error(err));
```

### 3.6 `src/bootstrap.ts`

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RemoteEntry } from '@erp/MODULE_NAME/feature';

bootstrapApplication(RemoteEntry, appConfig).catch((err) => console.error(err));
```

### 3.7 `src/app/app.config.ts`

```ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { sharedPrimeNGConfig } from '@erp/shared/ui';
import { remoteRoutes } from '@erp/MODULE_NAME/contract';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    sharedPrimeNGConfig,
  ],
};
```

### 3.8 `src/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>MODULE_NAME</title>
    <base href="/" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <link
      rel="icon"
      type="image/x-icon"
      href="favicon.ico"
    />
  </head>
  <body>
    <erp-MODULE_NAME-entry></erp-MODULE_NAME-entry>
  </body>
</html>
```

### 3.9 `src/styles.css`

```css
/* You can add global styles to this file, and also import other style files */
```

### 3.10 `eslint.config.mjs` (aplikacja)

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
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
```

---

## Krok 4: Uzupełnij pliki bibliotek

### 4.1 Feature — `RemoteEntry` component

Plik: `frontend/libs/modules/MODULE_NAME/feature/src/lib/entry.ts`

```ts
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
@Component({
  imports: [RouterModule],
  selector: 'erp-MODULE_NAME-entry',
  template: `<router-outlet></router-outlet>`,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `],
})
export class RemoteEntry {
}
```

Plik: `frontend/libs/modules/MODULE_NAME/feature/src/index.ts`

```ts
export * from './lib/entry';
```

### 4.2 Contract — Routes i Menu

Plik: `frontend/libs/modules/MODULE_NAME/contract/src/lib/entry.routes.ts`

```ts
import { Route } from '@angular/router';
import { erpAuthGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'MODULE_LABEL' },
    canActivate: [erpAuthGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
    ],
  },
];
```

Plik: `frontend/libs/modules/MODULE_NAME/contract/src/lib/entry.menu.ts`

```ts
import { ErpNavigationItem } from '@erp/shared/data-access';

export const remoteMenu: ErpNavigationItem[] = [
  {
    label: 'Dashboard',
    iconId: 'home',
    route: 'dashboard',
  },
];
```

Plik: `frontend/libs/modules/MODULE_NAME/contract/src/index.ts`

```ts
export * from './lib/entry.menu';

export * from './lib/entry.routes';
```

### 4.3 Data-Access, UI, Util

Upewnij się, że `src/index.ts` każdej z tych bibliotek istnieje (może być pusty lub z re-eksportem placeholder):

```ts
// frontend/libs/modules/MODULE_NAME/data-access/src/index.ts
// (pusty lub dodaj eksporty w miarę potrzeb)
```

```ts
// frontend/libs/modules/MODULE_NAME/ui/src/index.ts
// (pusty lub dodaj eksporty w miarę potrzeb)
```

```ts
// frontend/libs/modules/MODULE_NAME/util/src/index.ts
// (pusty lub dodaj eksporty w miarę potrzeb)
```

---

## Krok 5: Zarejestruj moduł w aplikacji Client (Host)

### 5.1 Manifest — `frontend/apps/client/public/module-federation.manifest.json`

Dodaj wpis:

```json
"MODULE_NAME": "http://localhost:PORT/mf-manifest.json"
```

### 5.2 Routing — `frontend/libs/client/contract/src/lib/app.routes.ts`

Dodaj nowy `path` w tablicy `children` (wewnątrz route'a z `canActivate: [erpAuthGuard]`):

```ts
{
  path: 'MODULE_NAME',
  loadChildren: () => loadRemote<typeof import('@erp/MODULE_NAME/contract')>('MODULE_NAME/contract').then((m) => m!.remoteRoutes),
},
```

### 5.3 Konfiguracja modułów — `frontend/libs/client/contract/src/lib/REMOTE_MODULES_CONFIG.ts`

Dodaj wpis do tablicy `REMOTE_MODULES_CONFIG`:

```ts
{ id: 'MODULE_NAME', label: 'MODULE_LABEL', routePrefix: 'MODULE_NAME' },
```

---

## Krok 6: Aktualizuj `eslint.config.mjs` (root)

Plik: `eslint.config.mjs` (w katalogu głównym workspace)

Dodaj nową regułę domenową w sekcji `depConstraints` (w bloku `--- 1. ZASADY DOMENOWE (SCOPE) ---`):

```js
{
  sourceTag: 'scope:MODULE_NAME',
  onlyDependOnLibsWithTags: ['scope:shared', 'scope:MODULE_NAME'],
},
```

Umieść ją **przed** regułą `scope:shared` (alfabetycznie lub na końcu listy scope, ale przed `scope:shared`).

---

## Krok 7: Aktualizuj `tsconfig.base.json`

Dodaj aliasy ścieżek w sekcji `compilerOptions.paths`:

```json
"@erp/MODULE_NAME/contract": ["frontend/libs/modules/MODULE_NAME/contract/src/index.ts"],
"@erp/MODULE_NAME/feature": ["frontend/libs/modules/MODULE_NAME/feature/src/index.ts"],
"@erp/MODULE_NAME/ui": ["frontend/libs/modules/MODULE_NAME/ui/src/index.ts"],
"@erp/MODULE_NAME/data-access": ["frontend/libs/modules/MODULE_NAME/data-access/src/index.ts"],
"@erp/MODULE_NAME/util": ["frontend/libs/modules/MODULE_NAME/util/src/index.ts"]
```

> **UWAGA**: Generator NX (`@nx/angular:library`) powinien dodać te wpisy automatycznie. **Zweryfikuj** po generacji, czy wszystkie 5 aliasów jest obecnych. Jeśli brakuje któregoś — dodaj ręcznie.

---

## Krok 8: Weryfikacja

Uruchom następujące komendy i upewnij się, że przechodzą bez błędów:

```bash
# 1. Sprawdź graph zależności
npx nx graph

# 2. Lint nowego modułu
npx nx lint MODULE_NAME
npx nx lint MODULE_NAME-feature
npx nx lint MODULE_NAME-contract

# 3. Build
npx nx build MODULE_NAME

# 4. Serve (powinien wystartować na przydzielonym porcie)
npx nx serve MODULE_NAME
```

---

## Podsumowanie — Checklist

- [ ] 5 bibliotek wygenerowanych (`contract`, `feature`, `ui`, `data-access`, `util`)
- [ ] Aplikacja MFE wygenerowana w `frontend/apps/modules/MODULE_NAME`
- [ ] `module-federation.config.ts` — exposes `./contract`
- [ ] `webpack.config.ts` i `webpack.prod.config.ts` — używają `createModuleFederationConfig`
- [ ] `bootstrap.ts` — importuje `RemoteEntry` z `@erp/MODULE_NAME/feature`
- [ ] `app.config.ts` — importuje `remoteRoutes` z `@erp/MODULE_NAME/contract`
- [ ] `entry.ts` w feature — komponent `RemoteEntry` z `<router-outlet>`
- [ ] `entry.routes.ts` i `entry.menu.ts` w contract — podstawowe trasy i menu
- [ ] `module-federation.manifest.json` — wpis z portem
- [ ] `app.routes.ts` (client) — nowy path z `loadRemote`
- [ ] `REMOTE_MODULES_CONFIG.ts` — nowy wpis
- [ ] `eslint.config.mjs` (root) — nowa reguła `scope:MODULE_NAME`
- [ ] `tsconfig.base.json` — 5 aliasów `@erp/MODULE_NAME/*`
- [ ] `project.json` każdej biblioteki — poprawne tagi `scope:MODULE_NAME` i `type:*`
- [ ] Port unikatowy i niekonfliktujący z istniejącymi

---

## Mapa portów (aktualna)

| Moduł | Port |
|-------|------|
| client (host) | 4200 |
| catalog | 4201 |
| inventory | 4202 |
| sales | 4203 |
| dms | 4204 |
| task-management | 4205 |
| **nowy moduł** | **następny wolny (4206+)** |
