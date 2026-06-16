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
```

---

## Krok 3: Skonfiguruj pliki aplikacji

Sprawdź i dostosuj pliki w `frontend/apps/modules/MODULE_NAME/`:

### 3.1 `project.json`

Kluczowe pola do zweryfikowania:
- `"name"` = `"MODULE_NAME"`, `"tags"` = `["scope:MODULE_NAME", "type:app"]`
- `serve.options.port` = `PORT`, `serve.options.publicHost` = `"http://localhost:PORT"`
- `serve.dependsOn` = `["client:serve"]`
- `build.options.customWebpackConfig.path` → `webpack.config.ts`
- `build.configurations.production.customWebpackConfig.path` → `webpack.prod.config.ts`

### 3.2 `module-federation.config.ts`

```ts
import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'MODULE_NAME',
  exposes: {
    './contract': 'frontend/libs/modules/MODULE_NAME/contract/src/index.ts',
  },
};

export default config;
```

### 3.3 `webpack.config.ts`

```ts
import { withModuleFederation } from '@nx/module-federation/angular';
import { createModuleFederationConfig } from '../../module-federation.shared';
import config from './module-federation.config';

export default withModuleFederation(createModuleFederationConfig(config), { dts: false });
```

### 3.4 `webpack.prod.config.ts`

```ts
import { withModuleFederation } from '@nx/module-federation/angular';
import { createModuleFederationConfig } from '../../module-federation.shared';
import config from './module-federation.config';

export default withModuleFederation(
  createModuleFederationConfig({
    ...config,
    /*
     * Remote overrides for production.
     * e.g. remotes: [['app1', 'https://app1.example.com']]
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
    "types": [],
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
