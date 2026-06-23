---
trigger: manual
---

# Przepis: Nowy moduł — Część 2: Biblioteki, integracja i weryfikacja

> **Część 1**: `nowy-modul-1-generacja.md` — parametry, komendy NX, pliki aplikacji.

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

Plik: `frontend/libs/modules/MODULE_NAME/contract/src/lib/entry.modals.ts`

```ts
/**
 * Identyfikatory modali tego modułu.
 * Służy do budowania globalnej mapy modalId → modulePrefix w ErpModalService.
 */
export const remoteModalIds: string[] = [
  // Dodaj stałe ID modali z @erp/MODULE_NAME/util
];

/**
 * Asynchronicznie ładuje i zwraca tokeny DI definicji modali tego modułu.
 * Używana przez ErpModalService do lazy loadingu.
 */
export async function registerModals(): Promise<any[]> {
  // const { MyModalDefinition } = await import('@erp/MODULE_NAME/feature');
  // return [MyModalDefinition];
  return [];
}
```

Plik: `frontend/libs/modules/MODULE_NAME/contract/src/index.ts`

```ts
export * from './lib/entry.menu';

export * from './lib/entry.routes';

export { registerModals, remoteModalIds } from './lib/entry.modals';
```

### 4.3 Data-Access, UI, Util

Upewnij się, że `src/index.ts` każdej biblioteki istnieje (może być pusty):

```ts
// frontend/libs/modules/MODULE_NAME/data-access/src/index.ts
// frontend/libs/modules/MODULE_NAME/ui/src/index.ts
// frontend/libs/modules/MODULE_NAME/util/src/index.ts
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

1. Dodaj nową regułę domenową w sekcji `depConstraints` (w bloku `--- 1. ZASADY DOMENOWE (SCOPE) ---`):

```js
{
  sourceTag: 'scope:MODULE_NAME',
  onlyDependOnLibsWithTags: ['scope:shared', 'scope:MODULE_NAME'],
},
```

Umieść ją **przed** regułą `scope:shared`.

2. Upewnij się, że w konfiguracji reguły `@nx/enforce-module-boundaries` w sekcji `allow` dodano regułę pozwalającą na importowanie pliku shared module federation bez wywoływania błędów lintera (`'^.*module-federation\\.shared$'`):

```js
allow: [
  '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
  '^.*module-federation\\.shared$',
  '@ngrx/.*'
],
```

---

## Krok 7: Aktualizuj `tsconfig.base.json`

Dodaj aliasy w `compilerOptions.paths`:

```json
"@erp/MODULE_NAME/contract": ["frontend/libs/modules/MODULE_NAME/contract/src/index.ts"],
"@erp/MODULE_NAME/feature": ["frontend/libs/modules/MODULE_NAME/feature/src/index.ts"],
"@erp/MODULE_NAME/ui": ["frontend/libs/modules/MODULE_NAME/ui/src/index.ts"],
"@erp/MODULE_NAME/data-access": ["frontend/libs/modules/MODULE_NAME/data-access/src/index.ts"],
"@erp/MODULE_NAME/util": ["frontend/libs/modules/MODULE_NAME/util/src/index.ts"]
```

> **UWAGA**: Generator NX dodaje te wpisy automatycznie, ale często z krótkimi, niepoprawnymi nazwami (np. `"contract": [...]` zamiast `"@erp/MODULE_NAME/contract": [...]`).
> **Musisz ręcznie zweryfikować te wpisy w `tsconfig.base.json`** i poprawić je na format z prefiksem `@erp/MODULE_NAME/`.
> Dodatkowo generator aplikacji remote może dodać automatyczny alias `"MODULE_NAME/Routes"` — należy go bezwzględnie usunąć z `tsconfig.base.json`.

---

## Krok 8: Weryfikacja

> **UWAGA**: Zanim uruchomisz komendy weryfikacji, zaleca się zresetować cache NX daemon za pomocą `npx nx reset`. Zapobiegnie to problemom typu "Could not find project MODULE_NAME" z powodu nieodświeżonego grafu projektów.

```bash
# 0. Reset cache NX
npx nx reset

# 1. Graph zależności
npx nx graph

# 2. Lint
npx nx lint MODULE_NAME
npx nx lint MODULE_NAME-feature
npx nx lint MODULE_NAME-contract

# 3. Build
npx nx build MODULE_NAME

# 4. Serve
npx nx serve MODULE_NAME
```

---

## Checklist

- [ ] 5 bibliotek wygenerowanych (`contract`, `feature`, `ui`, `data-access`, `util`)
- [ ] Aplikacja MFE w `frontend/apps/modules/MODULE_NAME`
- [ ] `module-federation.config.ts` — exposes `./contract`
- [ ] `webpack.config.ts` i `webpack.prod.config.ts` — używają `createModuleFederationConfig`
- [ ] `bootstrap.ts` — importuje `RemoteEntry` z `@erp/MODULE_NAME/feature`
- [ ] `app.config.ts` — importuje `remoteRoutes` z `@erp/MODULE_NAME/contract`
- [ ] `entry.ts` w feature — komponent `RemoteEntry` z `<router-outlet>`
- [ ] `entry.routes.ts`, `entry.menu.ts` i `entry.modals.ts` w contract (oraz ich poprawne eksporty w `index.ts`)
- [ ] `module-federation.manifest.json` — wpis z portem
- [ ] `app.routes.ts` (client) — nowy path z `loadRemote`
- [ ] `REMOTE_MODULES_CONFIG.ts` — nowy wpis
- [ ] `eslint.config.mjs` (root) — reguła `scope:MODULE_NAME`
- [ ] `tsconfig.base.json` — 5 aliasów `@erp/MODULE_NAME/*`
- [ ] `project.json` każdej biblioteki — poprawne tagi
- [ ] Port unikatowy

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
