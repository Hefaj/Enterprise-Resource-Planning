# Modale (lazy-loaded, przez `ErpModalService`)

Modal nie jest zwykłym komponentem otwieranym bezpośrednio przez inny komponent — jest **zarejestrowany globalnie** i ładowany leniwie na żądanie, z dowolnego miejsca w aplikacji, niezależnie od tego, w którym module fizycznie mieszka jego kod.

## Parametry przepisu

| Parametr | Wymagany | Opis |
|---|---|---|
| `MODULE_NAME` | ✅ | Nazwa modułu w **kebab-case** (np. `catalog`, `sales`) |
| `MODAL_NAME` | ✅ | Nazwa modalu w **kebab-case** (np. `set-price`, `add-discount`) |
| `MODAL_ID` | ✅ | Stała identyfikująca modal (np. `SET_PRICE_MODAL_ID`), zdefiniowana w `@erp/MODULE_NAME/util` |
| `COMMAND_TYPE` | ✅ | Klasa/interfejs komendy przekazywanej do zapisu (np. `BatchCommandOfProductSetPriceCommand`) |
| `METADATA_TYPE` | ❌ | Opcjonalny interfejs metadanych (domyślnie puste `{}`) |

---

## 1. Dlaczego modal jest rejestrowany, a nie importowany bezpośrednio

Moduł `sales` może potrzebować otworzyć modal zdefiniowany w module `catalog` (np. "dodaj produkt do zamówienia") — ale `sales` **nie może** zaimportować kodu `catalog` bezpośrednio, bo to złamałoby granice `scope:X` wymuszone przez ESLint (patrz [architektura frontendu](./architecture.md#3-tagi-nx-i-eslint-boundaries)) i, w trybie MFE, oznaczałoby statyczną zależność między dwoma osobno budowanymi aplikacjami.

Rozwiązanie: każdy moduł rejestruje swoje modale pod globalnie unikalnym `MODAL_ID` w warstwie `contract` (jedyna warstwa eksponowana przez Native Federation). Wywołujący zna tylko `MODAL_ID` i typ komendy:

```typescript
modalService.open(SET_PRICE_MODAL_ID, command);
```

`ErpModalService` w runtime mapuje `MODAL_ID → modulePrefix` (zbudowane podczas `STARTUP.ts`) i dopiero wtedy leniwie importuje `@erp/MODULE_NAME/feature`, żeby pobrać właściwą definicję.

---

## 2. Krok 1 — ID modalu (`util`)

Zadeklaruj i wyeksportuj stałą `MODAL_ID` w bibliotece `util` danego modułu (`@erp/MODULE_NAME/util`). Musi być globalnie unikalna w całej aplikacji — zalecany sposób to hash MD5 z nazwy akcji:

```bash
node -e "console.log(require('crypto').createHash('md5').update('MODULE_NAME.entity.action').digest('hex'))"
```

---

## 3. Krok 1.5 — Orkiestrator gotowy do zapisu (`data-access`)

Przed utworzeniem definicji modalu upewnij się, że orkiestrator (np. `CatalogProductOrchestrator`) ma metodę do wykonania komendy (np. `setPriceMultiple`). Jeśli nie — zaimplementuj ją najpierw, wg wzorca komend w [orkiestratorach, sekcja 6](./orchestrators.md#6-komendy-mutacje), i zaimportuj typ komendy z wygenerowanego klienta API.

---

## 4. Krok 1.7 — Teksty (Tłumaczenia)

Wszystkie stałe teksty widoczne dla użytkownika w modalu (tytuł, etykiety kroków, przycisk zapisu, placeholder, komunikaty błędów) idą przez klucze Transloco — zero hardcodowania. Procedura dodawania kluczy + `pnpm translate:keys`: [Tłumaczenia, sekcja 5](./translations.md#5-dodawanie-nowych-kluczy-do-istniejącego-scope-u). Zaimportuj wygenerowany obiekt kluczy (np. `PRODUCT_KEYS`) i używaj go bezpośrednio w definicji modalu i jego komponentach.

> [!IMPORTANT]
> Modal ma dostęp do swoich tłumaczeń niezależnie od tego, gdzie w aplikacji został otwarty, dzięki `getModalProviders()` — patrz [Tłumaczenia, sekcja 3](./translations.md#3-automatyczne-wstrzykiwanie-providerów-w-modalach). Definicja modalu **nigdy** nie woła `.setProviders(...)` w builderze.

---

## 5. Krok 2 — Pliki modalu (`feature`)

Katalog: `libs/modules/MODULE_NAME/feature/src/lib/.../modal/MODAL_NAME/`

```
modal/MODAL_NAME/
├── MODAL_NAME.definition.ts
├── MODAL_NAME.step.ts
└── index.ts
```

### 5.1 `MODAL_NAME.definition.ts`

Implementuje `ErpModalDefinition<COMMAND_TYPE, METADATA_TYPE>` — deklaratywnie opisuje modal przez `ErpModalBuilder`: tytuł (klucze tłumaczeń), listę kroków, `setOnSave` wołające metodę orkiestratora:

```typescript
import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { PascalCaseModalNameStepComponent } from './MODAL_NAME.step';
import { PascalCaseModuleNameProductOrchestrator } from '@erp/MODULE_NAME/data-access';
import { PRODUCT_KEYS } from '../../translation';
import { MODAL_ID } from '@erp/MODULE_NAME/util';

export type PascalCaseModalNameMetadata = Record<string, never>;

@Injectable({ providedIn: 'root' })
export class PascalCaseModalNameModalDefinition implements ErpModalDefinition<COMMAND_TYPE, PascalCaseModalNameMetadata> {
  public readonly id = MODAL_ID;
  private readonly _orchestrator = inject(PascalCaseModuleNameProductOrchestrator);

  public build(command: COMMAND_TYPE, metadata?: PascalCaseModalNameMetadata): ErpModalConfig<COMMAND_TYPE, PascalCaseModalNameMetadata> {
    return ErpModalBuilder.modal<COMMAND_TYPE, PascalCaseModalNameMetadata>(b => b
      .setTitle([PRODUCT_KEYS.base.tabs.products, PRODUCT_KEYS.commands.modalAction.modalTitle])
      .setCommand(command)
      .setMetadata(metadata)
      .addStep(PRODUCT_KEYS.commands.modalAction.label, PascalCaseModalNameStepComponent) // dokładnie jeden krok, chyba że modal jest wieloetapowy
      .setSaveLabel(PRODUCT_KEYS.commands.modalAction.submitButton)
      .setOnSave(async (cmd) => {
        await this._orchestrator.saveMethodName(cmd, MODAL_ID);
      })
    );
  }
}
```

### 5.2 `MODAL_NAME.step.ts`

Komponent kroku reprezentuje zawartość formularza. Przyjmuje `command`/`metadata` jako `WritableSignal` (input), zgłasza stan walidacji przez `registerCanGoNext`:

```typescript
import {
  ChangeDetectionStrategy, Component, computed, effect, input, Signal, WritableSignal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TuiTextfield } from '@taiga-ui/kit';
import { COMMAND_TYPE } from '@erp/MODULE_NAME/data-access';
import { PascalCaseModalNameMetadata } from './MODAL_NAME.definition';

@Component({
  selector: 'erp-MODULE_NAME-MODAL_NAME-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TuiTextfield],
  template: `<div class="MODAL_NAME-step"><!-- formularz --></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PascalCaseModalNameStepComponent {
  public command = input.required<WritableSignal<COMMAND_TYPE>>();
  public metadata = input.required<WritableSignal<PascalCaseModalNameMetadata>>();
  public registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  protected formControl = new FormControl<any>(null, [Validators.required]);
  protected canGoNext = computed(() => this.formControl.valid);

  constructor() {
    // Rejestracja walidacji kroku w formularzu nadrzędnym
    effect(() => {
      const register = this.registerCanGoNext();
      if (register) register(this.canGoNext);
    });

    // Command → Form: synchronizacja z początkowym stanem
    effect(() => {
      const cmd = this.command()();
      // zmapuj cmd na formControl
    });

    // Form → Command: aktualizacja stanu komendy
    this.formControl.valueChanges.subscribe((value) => {
      this.command().update((cmd) => ({ ...cmd /* zmapuj value */ }));
    });
  }
}
```

### 5.3 `index.ts` (katalog modalu)

```typescript
export * from './MODAL_NAME.definition';
export * from './MODAL_NAME.step';
export { MODAL_ID } from '@erp/MODULE_NAME/util';
```

---

## 6. Krok 3 — Publiczne API (`feature`)

Wyeksportuj nowy modal w `libs/modules/MODULE_NAME/feature/src/index.ts` — łącznie z pośrednimi plikami `index.ts` w hierarchii folderów (np. `.../modal/index.ts`), bo bez tego `import('@erp/MODULE_NAME/feature')` w kroku 7 nie znajdzie klasy definicji.

---

## 7. Krok 4 — Rejestracja w `contract` — dwa miejsca, które muszą się zgadzać

`libs/modules/MODULE_NAME/contract/src/lib/entry.modals.ts` (utwórz, jeśli nie istnieje) to jedyne miejsce, przez które `ErpModalService` "widzi" modale danego modułu:

```typescript
import { MODAL_ID } from '@erp/MODULE_NAME/util';

/** Identyfikatory modali tego modułu rejestrowane podczas STARTUP. */
export const remoteModalIds: string[] = [
  MODAL_ID,
];

/** Asynchroniczne leniwe ładowanie tokenu DI definicji modalu. */
export async function registerModals(): Promise<any[]> {
  const { PascalCaseModalNameModalDefinition } = await import('@erp/MODULE_NAME/feature');
  return [
    PascalCaseModalNameModalDefinition,
  ];
}
```

*Przy istniejącym pliku: dopisz import definicji i dodaj klasę do zwracanej tablicy obok istniejących.*

Wyeksportuj z `libs/modules/MODULE_NAME/contract/src/index.ts`:

```typescript
export { registerModals, remoteModalIds } from './lib/entry.modals';
```

`remoteModalIds` (statyczna lista stringów) jest potrzebna **osobno** od `registerModals()` (leniwy import): `STARTUP.ts` musi znać zbiór wszystkich ID już na starcie, żeby zbudować mapę `MODAL_ID → modulePrefix`, zanim jakikolwiek modal zostanie faktycznie otwarty. Rozdzielenie "co istnieje" (tanie, synchroniczne) od "jak to załadować" (kosztowne, leniwe) to ten sam wzorzec co `resolveEagerDependencies`/`_resolveCurrentDeps` w orkiestratorach.

**Pominięcie jednego z dwóch kroków daje różne objawy:** brak w `remoteModalIds` → `ErpModalService` w ogóle nie wie, że taki `MODAL_ID` istnieje; brak w `registerModals` → ID jest rozpoznane, ale import się nie udaje przy próbie otwarcia.

---

## 8. Krok 5 — CORS w dev-serverze (opcjonalnie)

Żeby uniknąć problemów z CORS przy dynamicznym ładowaniu (Native Federation), upewnij się, że `apps/modules/MODULE_NAME/project.json` (i `apps/client/project.json`) w `serve.options` mają:

```json
"serve": {
  "executor": "@nx/angular:dev-server",
  "options": {
    "port": 420X,
    "publicHost": "http://localhost:420X",
    "headers": { "Access-Control-Allow-Origin": "*" }
  }
}
```

---

## Zobacz też

- [Tłumaczenia](./translations.md) — `getModalProviders()`, zasada zero-hardcoded-stringów
- [Orkiestratory](./orchestrators.md) — skąd modal bierze metodę do wywołania w `setOnSave`
- [Nowy moduł](./new-module.md) — jeśli `entry.modals.ts` jeszcze nie istnieje w module
