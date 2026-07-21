---
trigger: manual
---

# Przepis: Nowy moduł — Część 2: Biblioteki, integracja i weryfikacja (Architektura Hybrydowa Monolit / MFE)

> **Część 1**: `nowy-modul-1-generacja.md` — parametry wejściowe, komendy NX, konfiguracja targetów hybrydowych `project.json`, `main.ts` i `main.mfe.ts`.

---

## Krok 4: Uzupełnij pliki bibliotek (`libs/modules/MODULE_NAME/`)

### 4.1 Feature — Pierwszy komponent strony (Page Component)

Stwórz pierwszy komponent dla głównej strony modułu w bibliotece `feature` (np. `WarehouseComponent` dla modułu `warehouse`):

Plik: `frontend/libs/modules/MODULE_NAME/feature/src/lib/MODULE_NAME.component.ts`

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'erp-MODULE_NAME-placeholder',
  standalone: true,
  template: `MODULE_NAME works!`,
  styles: [`
    :host {
      display: block;
      padding: 1rem;
    }
  `],
})
export class MODULE_NAMEComponent {}
```

Plik: `frontend/libs/modules/MODULE_NAME/feature/src/index.ts`

```ts
export * from './lib/MODULE_NAME.component';
export * from './lib/translation';
```

---

### 4.2 Contract — Routes, Menu i Modale ⭐ Eksportowane przez Native Federation

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
      {
        path: 'dashboard',
        loadComponent: () => import('@erp/MODULE_NAME/feature').then((m) => m.MODULE_NAMEComponent),
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

Plik: `frontend/libs/modules/MODULE_NAME/contract/src/lib/entry.modals.ts`

```ts
/**
 * Identyfikatory modali tego modułu.
 * Służą do budowania globalnej mapy modalId → modulePrefix w ErpModalService podczas startu aplikacji.
 */
export const remoteModalIds: string[] = [
  // Dodaj stałe ID modali eksportowane z @erp/MODULE_NAME/util
];

/**
 * Asynchronicznie ładuje i zwraca definicje komponentów/builderów modali tego modułu.
 * Wywoływana przez ErpModalService przy lazy loadingu dialogów.
 */
export async function registerModals(): Promise<any[]> {
  // const { MyModalDefinition } = await import('@erp/MODULE_NAME/feature');
  // return [MyModalDefinition];
  return [];
}

/**
 * Asynchronicznie ładuje providery tłumaczeń dla modali z tego remota.
 * W architekturze MFE ErpModalService automatycznie wstrzykuje te providery do child injectora dialogu.
 */
export async function getModalProviders(): Promise<any[]> {
  const { provideMODULE_NAMETranslations } = await import('@erp/MODULE_NAME/feature');
  return provideMODULE_NAMETranslations();
}
```

Plik: `frontend/libs/modules/MODULE_NAME/contract/src/index.ts`

```ts
export * from './lib/entry.menu';
export * from './lib/entry.routes';
export { registerModals, remoteModalIds, getModalProviders } from './lib/entry.modals';
```

---

### 4.3 Data-Access, UI, Util

Upewnij się, że plik `src/index.ts` każdej z pozostałych bibliotek istnieje (może być na start pusty lub eksportować podstawowe typy):

```ts
// frontend/libs/modules/MODULE_NAME/data-access/src/index.ts
// frontend/libs/modules/MODULE_NAME/ui/src/index.ts
// frontend/libs/modules/MODULE_NAME/util/src/index.ts
```

---

### 4.4 Konfiguracja Tłumaczeń (Transloco + Generator) ⭐ `RULE[tlumaczenia.md]`

Wszystkie teksty widoczne dla użytkownika w nowym module muszą korzystać z typowanych kluczy Transloco.

1. Utwórz strukturę katalogów `translation/` wewnątrz biblioteki `feature`:
   ```
   frontend/libs/modules/MODULE_NAME/feature/src/lib/translation/
   ├── index.ts
   ├── pl-PL.json
   └── en-US.json
   ```

2. Plik `pl-PL.json`:
   ```json
   {
     "dashboard": {
       "title": "MODULE_LABEL"
     }
   }
   ```

3. Plik `en-US.json`:
   ```json
   {
     "dashboard": {
       "title": "MODULE_LABEL"
     }
   }
   ```

4. Plik `index.ts` (rejestracja scope'u tłumaczeń modułu wraz ze współdzielonym scope'em `shared`):
   ```ts
   import { provideTranslocoScope } from '@jsverse/transloco';

   export function provideMODULE_NAMETranslations() {
     return [
       provideTranslocoScope({
         scope: 'MODULE_NAME',
         loader: {
           en: () => import('./en-US.json'),
           pl: () => import('./pl-PL.json'),
         },
       }),
       provideTranslocoScope('shared'),
     ];
   }
   ```

5. **Wygeneruj typowane klucze (`keys.ts`)**:
   Z poziomu głównego katalogu monorepo uruchom generator tłumaczeń:
   ```bash
   pnpm translate:keys
   ```
   Skrypt przeskanuje repozytorium i wygeneruje plik `keys.ts` (`MODULE_NAME_KEYS`) w katalogu `translation/`.

---

## Krok 5: Zarejestruj moduł w aplikacji Client (Host) ⭐ Rejestracja Hybrydowa

### 5.1 Manifest — `frontend/apps/client/public/module-federation.manifest.json`

Dodaj wpis wskazujący na URL pliku `remoteEntry.json` remota (używany w trybie MFE / `production`):

```json
"MODULE_NAME": "http://localhost:PORT/remoteEntry.json"
```

### 5.2 Loader — `frontend/libs/client/contract/src/lib/module-loaders.ts` ⭐ Tryb Monolit (DEV)

W trybie Monolitu host ładuje kontrakty bezpośrednio przez statyczne importy ESM. Dodaj nowy wpis do mapy `MODULE_LOADERS`:

```ts
export const MODULE_LOADERS: Record<string, () => Promise<any>> = {
  // ...istniejące moduły...
  'MODULE_NAME': () => import('@erp/MODULE_NAME/contract'),
};
```

> **UWAGA**: W pliku [`module-loaders.mfe.ts`](file:///c:/repos/Enterprise-Resource-Planning/frontend/libs/client/contract/src/lib/module-loaders.mfe.ts) (obsługującym tryb MFE) nie musisz nic dodawać — funkcja `loadModuleContract` dynamicznie wywołuje `loadRemoteModule({ remoteName: modulePrefix, exposedModule: './contract' })` dla dowolnego zarejestrowanego prefiksu!

### 5.3 Routing — `frontend/libs/client/contract/src/lib/app.routes.ts`

Dodaj nową ścieżkę do tablicy `children` wewnątrz głównego layoutu. Używamy centralnej funkcji `loadModuleRoutes('MODULE_NAME')`:

```ts
{
  path: 'MODULE_NAME',
  loadChildren: () => loadModuleRoutes('MODULE_NAME'),
},
```

### 5.4 Konfiguracja modułów — `frontend/libs/client/contract/src/lib/REMOTE_MODULES_CONFIG.ts`

Dodaj obiekt konfiguracji do tablicy `REMOTE_MODULES_CONFIG`:

```ts
{ id: 'MODULE_NAME', label: 'MODULE_LABEL', routePrefix: 'MODULE_NAME' },
```

> **Dlaczego to ważne?**
> - W trakcie startu (`STARTUP.ts`) aplikacja automatycznie pobiera kontrakt remota za pomocą `loadModuleContract('MODULE_NAME')`.
> - Rejestruje elementy menu w centralnym nawigatorze oraz identyfikatory modali (`remoteModalIds`) w `ErpModalService`.
> - Zapisuje centralny loader (`registerContractLoader`), dzięki czemu otwieranie modali w trybie rozproszonym (MFE) działa bezbłędnie wraz z izolowanym wstrzykiwaniem tłumaczeń!

### 5.5 Konfiguracja API_BASE_URL — `frontend/apps/client/src/app/remote-api.providers.ts`

Dodaj import tokenu i zarejestruj bazowy URL do endpointów BFF (np. port 5250):

```ts
import { API_BASE_URL as MODULE_NAME_API_BASE_URL } from '@erp/MODULE_NAME/data-access';

export const remoteApiProviders: Provider[] = [
  // ...
  { provide: MODULE_NAME_API_BASE_URL, useValue: 'http://localhost:BACKEND_PORT' },
];
```

---

## Krok 6: Aktualizuj `eslint.config.mjs` (root)

Plik: `eslint.config.mjs` (w katalogu głównym workspace)

Dodaj nową regułę domenową w bloku `--- 1. ZASADY DOMENOWE (SCOPE) ---` (przed regułą `scope:shared`):

```js
{
  sourceTag: 'scope:MODULE_NAME',
  onlyDependOnLibsWithTags: ['scope:shared', 'scope:MODULE_NAME'],
},
```

---

## Krok 7: Aktualizuj `tsconfig.base.json`

Upewnij się, że w `compilerOptions.paths` znajdują się poprawne aliasy TS:

```json
"@erp/MODULE_NAME/contract": ["frontend/libs/modules/MODULE_NAME/contract/src/index.ts"],
"@erp/MODULE_NAME/feature": ["frontend/libs/modules/MODULE_NAME/feature/src/index.ts"],
"@erp/MODULE_NAME/ui": ["frontend/libs/modules/MODULE_NAME/ui/src/index.ts"],
"@erp/MODULE_NAME/data-access": ["frontend/libs/modules/MODULE_NAME/data-access/src/index.ts"],
"@erp/MODULE_NAME/util": ["frontend/libs/modules/MODULE_NAME/util/src/index.ts"]
```

> **UWAGA**: Generator NX automatycznie dodaje wpisy do `tsconfig.base.json`, ale często z krótkimi, błędnymi nazwami (np. `"contract": [...]` zamiast `"@erp/MODULE_NAME/contract": [...]`). **Musisz zweryfikować te wpisy i poprawić je na format z prefiksem `@erp/MODULE_NAME/`**. Dodatkowo usuń automatycznie dodany alias typu `"MODULE_NAME/Routes"`, jeśli się pojawił.

---

## Krok 8: Weryfikacja

Zanim uruchomisz komendy weryfikacji, **zresetuj cache NX daemon** (`npx nx reset`), aby graf projektów rozpoznał nowy moduł i jego aliasy.

```bash
# 0. Reset cache NX
npx nx reset

# 1. Sprawdź poprawność reguł ESLint
npx nx lint MODULE_NAME
npx nx lint MODULE_NAME-contract
npx nx lint MODULE_NAME-feature

# 2. Weryfikacja builda i uruchomienia w trybie MONOLIT (DEV)
npx nx run client:esbuild:development
# Lub odpal domyślny serwer dev monolitu:
npx nx serve client

# 3. Weryfikacja builda w trybie MIKROFRONTENDÓW (PROD/MFE)
npx nx run MODULE_NAME:build:production
npx nx run client:build:production
```

---

## Checklist Końcowa

- [ ] 5 bibliotek wygenerowanych (`contract`, `feature`, `ui`, `data-access`, `util`)
- [ ] Aplikacja remote w `frontend/apps/modules/MODULE_NAME` z wyczyszczonymi plikami boilerplate i e2e
- [ ] `project.json` (remote) — targety (`build`, `serve`, `serve-mfe`, `serve-mfe-remote`, `esbuild`, `serve-original`) skonfigurowane na port `PORT`
- [ ] `federation.config.mjs` — eksponuje `./contract`, a wewnętrzne biblioteki (`@erp/MODULE_NAME/*`) są w sekcji `skip`
- [ ] `src/main.ts` (`import('./bootstrap')`) oraz `src/main.mfe.ts` (`initFederation()`) podmieniane przez `fileReplacements`
- [ ] `entry.routes.ts`, `entry.menu.ts` i `entry.modals.ts` (w tym `getModalProviders`) utworzone w `contract` i wyeksportowane w `index.ts`
- [ ] Tłumaczenia Transloco utworzone w `feature/src/lib/translation/` i wygenerowane przez `pnpm translate:keys`
- [ ] `module-federation.manifest.json` — wpis z URL `http://localhost:PORT/remoteEntry.json`
- [ ] `module-loaders.ts` — dodana funkcja importująca `@erp/MODULE_NAME/contract`
- [ ] `app.routes.ts` (client) — dodany route z `loadChildren: () => loadModuleRoutes('MODULE_NAME')`
- [ ] `REMOTE_MODULES_CONFIG.ts` — dodany obiekt z `routePrefix: 'MODULE_NAME'`
- [ ] `remote-api.providers.ts` — zarejestrowany port BFF dla `API_BASE_URL` modułu
- [ ] `eslint.config.mjs` — reguła `scope:MODULE_NAME`
- [ ] `tsconfig.base.json` — 5 poprawnych aliasów `@erp/MODULE_NAME/*`
- [ ] `npx nx lint MODULE_NAME` oraz buildy weryfikacyjne (`esbuild:development` i `build:production`) zakończone sukcesem

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
| notification | 4206 |
| **nowy moduł** | **następny wolny (4207+)** |
