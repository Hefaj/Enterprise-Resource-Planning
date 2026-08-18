# Nowy moduł — architektura hybrydowa Monolit / MFE

Dodanie nowego modułu biznesowego (kolejny remote obok `catalog`, `inventory`, `sales`...) wymaga wielu plików konfiguracyjnych, które muszą się ze sobą zgadzać. Ten dokument jest pełnym przepisem — dokładne komendy, gotowe do wklejenia szablony i uzasadnienie decyzji tam, gdzie łatwo o pomyłkę.

## Parametry wejściowe

| Parametr | Wymagany | Opis |
|---|---|---|
| `MODULE_NAME` | ✅ | Nazwa modułu w **kebab-case** (np. `warehouse`, `hr-management`) |
| `MODULE_LABEL` | ✅ | Wyświetlana nazwa modułu po polsku (np. `Magazyn`, `HR`) |
| `PORT` | ❌ | Port dev-servera. Jeśli nie podany — znajdź najwyższy zajęty port we wszystkich `frontend/apps/modules/*/project.json` (target `serve`) i przypisz `najwyższy + 1`. Client: `4200`, moduły od `4201`. |

## Konwencje nazewnicze

| Element | Wzorzec | Przykład (`warehouse`) |
|---|---|---|
| Scope tag | `scope:MODULE_NAME` | `scope:warehouse` |
| Alias TS | `@erp/MODULE_NAME/*` | `@erp/warehouse/feature` |
| App path | `frontend/apps/modules/MODULE_NAME` | `frontend/apps/modules/warehouse` |
| Lib path | `frontend/libs/modules/MODULE_NAME` | `frontend/libs/modules/warehouse` |
| Selektor entry | `app-MODULE_NAME-entry` | `app-warehouse-entry` |

---

## Krok 1: Wygeneruj biblioteki (5 warstw)

Z katalogu **root workspace** (tam gdzie `nx.json`). Zależności między bibliotekami są wymuszane przez ESLint (`@nx/enforce-module-boundaries`) — patrz [architektura frontendu](./architecture.md#3-pięć-warstw-modułu).

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

> [!WARNING]
> Sprawdź `project.json` każdej wygenerowanej biblioteki — pole `name` powinno mieć format `MODULE_NAME-WARSTWA` (np. `warehouse-feature`). Popraw ręcznie, jeśli generator nadał inną nazwę.

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

### 2.1 Czyszczenie boilerplate i e2e

Generator tworzy nieużywane lokalne pliki routingu i e2e — cała logika modułu żyje w dedykowanych bibliotekach:

```bash
# 1. Usuń wygenerowany projekt e2e (nieużywany w monorepo)
rm -rf frontend/apps/modules/MODULE_NAME-e2e

# 2. Usuń lokalne pliki routingu i komponentów remote-entry
rm -rf frontend/apps/modules/MODULE_NAME/src/app/app.routes.ts \
       frontend/apps/modules/MODULE_NAME/src/app/remote-entry

# 3. Usuń pliki Webpack Module Federation (używamy Native Federation)
rm -f frontend/apps/modules/MODULE_NAME/module-federation.config.ts \
      frontend/apps/modules/MODULE_NAME/webpack.config.ts \
      frontend/apps/modules/MODULE_NAME/webpack.prod.config.ts
```

---

## Krok 3: Skonfiguruj pliki aplikacji

### Dlaczego dwa punkty wejścia

Każdy remote działa w dwóch trybach z **tego samego** kodu źródłowego:

| Tryb | Kiedy | Jak |
|---|---|---|
| **Monolit** (`serve`, dev) | codzienna praca nad jednym modułem, szybki dev-server bez narzutu federacji | `src/main.ts` woła bezpośrednio `bootstrap.ts`, bez `initFederation()` |
| **MFE** (`serve-mfe`, `build:production`) | integracja z hostem, produkcja | `src/main.mfe.ts` woła `initFederation()`, moduł eksponuje `remoteEntry.json` |

Przełączanie dzieje się przez `fileReplacements` w konfiguracjach `production`/`mfe` targetu `esbuild` w `project.json`. Jeśli coś działa w `nx serve MODULE_NAME` (monolit), ale wywala się w `nx run client:serve-mfe` (MFE) — podejrzewaj najpierw `federation.config.mjs` albo różnicę między `main.ts`/`main.mfe.ts`.

### 3.1 `project.json` — targety hybrydowe

- `"name"` = `"MODULE_NAME"`, `"tags"` = `["scope:MODULE_NAME", "type:app"]`
- `"build"`: `@angular-architects/native-federation:build` (`production`/`mfe`).
- `"serve"`: `@angular-devkit/build-angular:dev-server`, `buildTarget: "MODULE_NAME:esbuild:development"` — czysty dev-server monolitu na porcie `PORT` z nagłówkami CORS.
- `"serve-mfe"`: `nx:run-commands`, uruchamia równolegle remote (`MODULE_NAME:serve-mfe-remote`) i host (`client:serve-mfe`).
- `"serve-mfe-remote"`: `@angular-architects/native-federation:build`, `target: "MODULE_NAME:serve-original:mfe"` — remote jako mikrofrontend na porcie `PORT`.
- `"esbuild"`: czysty `@angular/build:application`. W `production`/`mfe` ma `"fileReplacements"` podmieniające wejście na `main.mfe.ts`.
- `"serve-original"`: `@nx/angular:dev-server` na porcie `PORT` z CORS — serwer wewnętrzny używany pod spodem przez Native Federation.

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
      "continuous": true,
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "port": PORT,
        "publicHost": "http://localhost:PORT",
        "headers": { "Access-Control-Allow-Origin": "*" }
      },
      "configurations": {
        "production": { "buildTarget": "MODULE_NAME:build:production" },
        "development": { "buildTarget": "MODULE_NAME:esbuild:development" }
      },
      "defaultConfiguration": "development"
    },
    "serve-mfe": {
      "executor": "nx:run-commands",
      "options": {
        "commands": ["nx run MODULE_NAME:serve-mfe-remote", "nx run client:serve-mfe"],
        "parallel": true
      }
    },
    "serve-mfe-remote": {
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
            { "replace": "frontend/apps/modules/MODULE_NAME/src/main.ts", "with": "frontend/apps/modules/MODULE_NAME/src/main.mfe.ts" }
          ]
        },
        "development": {
          "optimization": false, "extractLicenses": false, "sourceMap": true, "namedChunks": true
        },
        "mfe": {
          "optimization": false, "extractLicenses": false, "sourceMap": true, "namedChunks": true,
          "fileReplacements": [
            { "replace": "frontend/apps/modules/MODULE_NAME/src/main.ts", "with": "frontend/apps/modules/MODULE_NAME/src/main.mfe.ts" }
          ]
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
        "development": { "buildTarget": "MODULE_NAME:esbuild:development" },
        "mfe": { "buildTarget": "MODULE_NAME:esbuild:mfe" }
      },
      "defaultConfiguration": "development"
    },
    "extract-i18n": {
      "executor": "@angular-devkit/build-angular:extract-i18n",
      "options": { "buildTarget": "MODULE_NAME:build" }
    },
    "lint": { "executor": "@nx/eslint:lint" },
    "test": {
      "executor": "@nx/vitest:test",
      "outputs": ["{options.reportsDirectory}"],
      "options": { "reportsDirectory": "../../../../coverage/frontend/apps/modules/MODULE_NAME" }
    }
  }
}
```

### 3.2 `federation.config.mjs` — Native Federation z zachowaniem Vite HMR

Eksponuje wyłącznie `./contract`. Generator NX i `shareAll()` domyślnie próbują współdzielić **wszystko**, łącznie z bibliotekami, których żaden inny moduł nigdy nie zaimportuje (`@erp/MODULE_NAME/feature`, `data-access`, `ui`, `util` — używane wyłącznie przez ten jeden moduł). Efekt uboczny: Native Federation pre-bundluje je do osobnych chunków, które **nie są objęte Vite HMR** (pełny mechanizm: [architektura frontendu, sekcja 4](./architecture.md#4-native-federation--współdzielenie-zależności-i-hmr)).

> [!WARNING]
> Wewnętrzne biblioteki modułu **muszą** być w tablicy `skip`, inaczej zmiana w komponencie nie odświeży się bez restartu dev-servera. To jest krok, który najłatwiej pominąć (build i tak przejdzie bez błędu).

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
    // Wewnętrzne biblioteki modułu — bundlowane inline, wspierają Vite HMR
    '@erp/MODULE_NAME/feature',
    '@erp/MODULE_NAME/data-access',
    '@erp/MODULE_NAME/ui',
    '@erp/MODULE_NAME/util',
    // Zewnętrzne biblioteki nie współdzielone w runtime
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

  features: { denseChunking: true },
});
```

### 3.3 Dwa punkty wejścia

**`src/main.ts`** — tryb Monolitu (domyślny `development`), bez `initFederation()`:

```ts
import('./bootstrap').catch((err) => console.error(err));
```

**`src/main.mfe.ts`** — tryb Mikrofrontendów (`production`/`mfe`, przez `fileReplacements`):

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

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';

@Component({
  selector: 'app-MODULE_NAME-entry',
  standalone: true,
  imports: [RouterOutlet, TuiRoot],
  template: `<tui-root><router-outlet></router-outlet></tui-root>`,
  styles: [`:host { display: block; height: 100vh; }`],
})
export class AppComponent {}
```

### 3.6 `src/app/app.config.ts`

`provideRemoteDevSupport()` z `@erp/shared/ui` konfiguruje automatycznie podstawowe usługi (Transloco, HttpClient, TaigaUI) i rejestruje modale modułu w `ErpModalService` przy samodzielnym uruchomieniu remota.

> [!WARNING]
> Importuj `remoteRoutes`/`remoteModalIds`/`registerModals`/`getModalProviders` STATYCZNIE i przekaż je wprost do `provideRemoteDevSupport()`, NIE przez `contractLoader: () => import(...)`. Ten plik już importuje `remoteRoutes` statycznie (potrzebne synchronicznie dla `provideRouter`) — dołożenie do niego DODATKOWO dynamicznego `import('@erp/MODULE_NAME/contract')` w `contractLoader` sprawia, że `@nx/enforce-module-boundaries` widzi tę samą bibliotekę importowaną i statycznie, i dynamicznie w jednym pliku, i wywala `npx nx lint MODULE_NAME` błędem "Static imports of lazy-loaded libraries are forbidden". Zweryfikowane empirycznie przy module `identity` — wzorzec poniżej (statyczne importy) jest tym, którego faktycznie używa `catalog` i który przechodzi lint.

```ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { remoteRoutes, remoteModalIds, registerModals, getModalProviders } from '@erp/MODULE_NAME/contract';
import { API_BASE_URL } from '@erp/MODULE_NAME/data-access';
import { provideRemoteDevSupport } from '@erp/shared/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRemoteDevSupport({
      modulePrefix: 'MODULE_NAME',
      remoteModalIds,
      registerModals,
      getModalProviders,
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(remoteRoutes),
    { provide: API_BASE_URL, useValue: 'http://localhost:BACKEND_PORT' }, // port mikroserwisu API modułu
  ],
};
```

### 3.7 `src/styles.css`

```css
html, body, app-MODULE_NAME-entry, tui-root {
  margin: 0; padding: 0; height: 100%; width: 100%; display: block;
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
    <app-MODULE_NAME-entry></app-MODULE_NAME-entry>
  </body>
</html>
```

### 3.9 `eslint.config.mjs` (katalog aplikacji)

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

Po usunięciu wygenerowanych plików routingu/remote-entry wyczyść `"files"` i ustaw `"es2022"`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "outDir": "../../../../dist/out-tsc", "types": ["node"], "target": "es2022" },
  "include": ["src/**/*.ts"],
  "exclude": [
    "src/**/*.spec.ts", "src/**/*.test.ts", "vite.config.ts", "vite.config.mts",
    "vitest.config.ts", "vitest.config.mts", "src/**/*.test.tsx", "src/**/*.spec.tsx",
    "src/**/*.test.js", "src/**/*.spec.js", "src/**/*.test.jsx", "src/**/*.spec.jsx", "src/test-setup.ts"
  ],
  "files": []
}
```

---

## Krok 4: Uzupełnij biblioteki

### 4.1 Feature — pierwszy komponent strony

`frontend/libs/modules/MODULE_NAME/feature/src/lib/MODULE_NAME.component.ts`:

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'erp-MODULE_NAME-placeholder',
  standalone: true,
  template: `MODULE_NAME works!`,
  styles: [`:host { display: block; padding: 1rem; }`],
})
export class MODULE_NAMEComponent {}
```

`frontend/libs/modules/MODULE_NAME/feature/src/index.ts`:

```ts
export * from './lib/MODULE_NAME.component';
export * from './lib/translation';
```

### 4.2 Contract — Routes, Menu, Modale

`contract` jest **jedyną** warstwą eksponowaną przez `federation.config.mjs` — host nigdy nie importuje `feature`/`ui`/`data-access`/`util` innego modułu bezpośrednio, ta sama granica co ESLint `scope:X`, tylko egzekwowana w runtime zamiast compile-time. Eksponuje trzy rzeczy, każda z osobnym mechanizmem leniwego ładowania: `remoteRoutes` (przez `loadRemoteModule()`, gdy użytkownik wejdzie na trasę), `remoteMenu` (zbierane przez `STARTUP.ts` na starcie hosta), `remoteModalIds`/`registerModals`/`getModalProviders` (patrz [modale](./modals.md)).

`frontend/libs/modules/MODULE_NAME/contract/src/lib/entry.routes.ts`:

```ts
import { Route } from '@angular/router';
import { erpAuthGuard } from '@erp/shared/auth';

export const remoteRoutes: Route[] = [
  {
    path: '',
    data: { breadcrumb: 'MODULE_LABEL' },
    canActivate: [erpAuthGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('@erp/MODULE_NAME/feature').then((m) => m.MODULE_NAMEComponent) },
    ],
  },
];
```

`frontend/libs/modules/MODULE_NAME/contract/src/lib/entry.menu.ts`:

```ts
import { ErpNavigationItem } from '@erp/shared/data-access';

export const remoteMenu: ErpNavigationItem[] = [
  { label: 'Dashboard', iconId: 'home', route: 'dashboard' },
];
```

`frontend/libs/modules/MODULE_NAME/contract/src/lib/entry.modals.ts`:

```ts
/** Identyfikatory modali tego modułu — mapa modalId → modulePrefix w ErpModalService podczas startu. */
export const remoteModalIds: string[] = [
  // stałe ID modali eksportowane z @erp/MODULE_NAME/util
];

/** Ładuje i zwraca definicje modali tego modułu. Wywoływane przez ErpModalService przy lazy loadingu. */
export async function registerModals(): Promise<any[]> {
  // const { MyModalDefinition } = await import('@erp/MODULE_NAME/feature');
  // return [MyModalDefinition];
  return [];
}

/** Ładuje providery tłumaczeń dla modali z tego remota — ErpModalService wstrzykuje je automatycznie. */
export async function getModalProviders(): Promise<any[]> {
  const { provideMODULE_NAMETranslations } = await import('@erp/MODULE_NAME/feature');
  return provideMODULE_NAMETranslations();
}
```

`frontend/libs/modules/MODULE_NAME/contract/src/index.ts`:

```ts
export * from './lib/entry.menu';
export * from './lib/entry.routes';
export { registerModals, remoteModalIds, getModalProviders } from './lib/entry.modals';
```

### 4.3 Data-Access, UI, Util

Upewnij się, że `src/index.ts` każdej biblioteki istnieje (może być pusty na start).

### 4.4 Tłumaczenia (Transloco + generator)

Nowy moduł potrzebuje własnego scope'u Transloco od pierwszego commita. Utwórz `frontend/libs/modules/MODULE_NAME/feature/src/lib/translation/{index.ts,pl-PL.json,en-US.json}` i uruchom `pnpm translate:keys`. Pełny mechanizm (DI shadowing, `getModalProviders`, bootstrapping scope'u vs. dodawanie kluczy): [Tłumaczenia](./translations.md), sekcja 4.

---

## Krok 5: Zarejestruj moduł w Client (Host)

Host musi umieć znaleźć moduł na dwa sposoby, zależnie od trybu: w **monolicie** przez statyczny import ESM (`module-loaders.ts`), w **MFE** przez generyczny `loadRemoteModule()` (`module-loaders.mfe.ts` — nie wymaga zmian dla nowego modułu). `REMOTE_MODULES_CONFIG` spina oba tryby z routingiem i menu — `STARTUP.ts` iteruje po nim, żeby wiedzieć, jakie moduły w ogóle próbować załadować.

### 5.1 Manifest — `frontend/apps/client/public/module-federation.manifest.json`

URL `remoteEntry.json` (tryb MFE):

```json
"MODULE_NAME": "http://localhost:PORT/remoteEntry.json"
```

### 5.2 Loader — `frontend/libs/client/contract/src/lib/module-loaders.ts` (tryb Monolit)

```ts
export const MODULE_LOADERS: Record<string, () => Promise<any>> = {
  // ...istniejące moduły...
  'MODULE_NAME': () => import('@erp/MODULE_NAME/contract'),
};
```

> `module-loaders.mfe.ts` nie wymaga zmian — `loadModuleContract` dynamicznie woła `loadRemoteModule({ remoteName: modulePrefix, exposedModule: './contract' })` dla dowolnego zarejestrowanego prefiksu.

### 5.3 Routing — `frontend/libs/client/contract/src/lib/app.routes.ts`

```ts
{
  path: 'MODULE_NAME',
  loadChildren: () => loadModuleRoutes('MODULE_NAME'),
},
```

### 5.4 Konfiguracja — `frontend/libs/client/contract/src/lib/REMOTE_MODULES_CONFIG.ts`

```ts
{ id: 'MODULE_NAME', label: 'MODULE_LABEL', routePrefix: 'MODULE_NAME' },
```

### 5.5 API_BASE_URL — `frontend/apps/client/src/app/remote-api.providers.ts`

```ts
import { API_BASE_URL as MODULE_NAME_API_BASE_URL } from '@erp/MODULE_NAME/data-access';

export const remoteApiProviders: Provider[] = [
  // ...
  { provide: MODULE_NAME_API_BASE_URL, useValue: 'http://localhost:BACKEND_PORT' },
];
```

---

## Krok 6: `eslint.config.mjs` (root)

Dodaj regułę domenową w bloku `--- 1. ZASADY DOMENOWE (SCOPE) ---`, przed regułą `scope:shared`:

```js
{
  sourceTag: 'scope:MODULE_NAME',
  onlyDependOnLibsWithTags: ['scope:shared', 'scope:MODULE_NAME'],
},
```

---

## Krok 7: `tsconfig.base.json`

```json
"@erp/MODULE_NAME/contract": ["frontend/libs/modules/MODULE_NAME/contract/src/index.ts"],
"@erp/MODULE_NAME/feature": ["frontend/libs/modules/MODULE_NAME/feature/src/index.ts"],
"@erp/MODULE_NAME/ui": ["frontend/libs/modules/MODULE_NAME/ui/src/index.ts"],
"@erp/MODULE_NAME/data-access": ["frontend/libs/modules/MODULE_NAME/data-access/src/index.ts"],
"@erp/MODULE_NAME/util": ["frontend/libs/modules/MODULE_NAME/util/src/index.ts"]
```

> [!WARNING]
> Generator NX dodaje wpisy automatycznie, ale często z krótkimi, błędnymi nazwami (np. `"contract": [...]` zamiast `"@erp/MODULE_NAME/contract": [...]`). Zweryfikuj i popraw. Usuń automatycznie dodany alias typu `"MODULE_NAME/Routes"`, jeśli się pojawił.

---

## Krok 8: Weryfikacja

Zresetuj cache NX daemon przed weryfikacją, żeby graf projektów rozpoznał nowy moduł i jego aliasy:

```bash
# 0. Reset cache NX
npx nx reset

# 1. ESLint
npx nx lint MODULE_NAME
npx nx lint MODULE_NAME-contract
npx nx lint MODULE_NAME-feature

# 2. Build i uruchomienie w trybie MONOLIT (DEV)
npx nx run client:esbuild:development
npx nx serve client

# 3. Build w trybie MIKROFRONTENDÓW (PROD/MFE)
npx nx run MODULE_NAME:build:production
npx nx run client:build:production
```

---

## Checklist końcowa

- [ ] 5 bibliotek wygenerowanych (`contract`, `feature`, `ui`, `data-access`, `util`)
- [ ] Aplikacja remote z wyczyszczonymi plikami boilerplate i e2e
- [ ] `project.json` (remote) — targety (`build`, `serve`, `serve-mfe`, `serve-mfe-remote`, `esbuild`, `serve-original`) na porcie `PORT`
- [ ] `federation.config.mjs` — eksponuje `./contract`, wewnętrzne biblioteki w `skip`
- [ ] `src/main.ts` (`import('./bootstrap')`) oraz `src/main.mfe.ts` (`initFederation()`) podmieniane przez `fileReplacements`
- [ ] `entry.routes.ts`, `entry.menu.ts`, `entry.modals.ts` (z `getModalProviders`) w `contract`, wyeksportowane w `index.ts`
- [ ] Tłumaczenia w `feature/src/lib/translation/`, wygenerowane przez `pnpm translate:keys`
- [ ] `module-federation.manifest.json` — wpis z URL `remoteEntry.json`
- [ ] `module-loaders.ts` — dodana funkcja importująca `@erp/MODULE_NAME/contract`
- [ ] `app.routes.ts` (client) — route z `loadChildren: () => loadModuleRoutes('MODULE_NAME')`
- [ ] `REMOTE_MODULES_CONFIG.ts` — obiekt z `routePrefix: 'MODULE_NAME'`
- [ ] `remote-api.providers.ts` — port mikroserwisu API dla `API_BASE_URL`
- [ ] `eslint.config.mjs` (root) — reguła `scope:MODULE_NAME`
- [ ] `tsconfig.base.json` — 5 poprawnych aliasów `@erp/MODULE_NAME/*`
- [ ] `npx nx lint MODULE_NAME` i buildy weryfikacyjne zakończone sukcesem

Jeśli po dodaniu modułu coś "prawie działa" (widać w menu, ale routing 404, albo modal się nie otwiera) — to niemal zawsze jeden z powyższych punktów został pominięty, nie błąd w logice modułu.

---

## Mapa portów (aktualna)

| Moduł | Port |
|---|---|
| client (host) | 4200 |
| catalog | 4201 |
| inventory | 4202 |
| sales | 4203 |
| dms | 4204 |
| task-management | 4205 |
| notification | 4206 |
| **nowy moduł** | **następny wolny (4207+)** |

---

## Zobacz też

- [Architektura frontendu](./architecture.md) — Native Federation, warstwy, HMR
- [Modale](./modals.md), [Tłumaczenia](./translations.md)
