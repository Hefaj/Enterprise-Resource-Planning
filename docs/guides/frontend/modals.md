# Modale (lazy-loaded, przez `ErpModalService`)

Modal nie jest zwykłym komponentem otwieranym bezpośrednio przez inny komponent — jest **zarejestrowany globalnie** i ładowany leniwie na żądanie, z dowolnego miejsca w aplikacji, niezależnie od tego, w którym module fizycznie mieszka jego kod.

## Parametry przepisu

| Parametr | Wymagany | Opis |
|---|---|---|
| `MODULE_NAME` | ✅ | Nazwa modułu w **kebab-case** (np. `catalog`, `sales`) |
| `MODAL_NAME` | ✅ | Nazwa modalu w **kebab-case** — patrz [konwencja nazewnicza](#konwencja-nazewnicza-modal-nazywa-się-jak-komenda) (np. `product-set-price` dla `ProductSetPriceCommand`) |
| `MODAL_ID` | ✅ | Stała identyfikująca modal (np. `PRODUCT_SET_PRICE_MODAL_ID`), zdefiniowana w `@erp/MODULE_NAME/util` |
| `COMMAND_TYPE` | ✅ | Klasa/interfejs komendy przekazywanej do zapisu (np. `BatchCommandOfProductSetPriceCommand`) |
| `METADATA_TYPE` | ❌ | Opcjonalny interfejs metadanych (domyślnie puste `{}`) |

### Konwencja nazewnicza: modal nazywa się jak komenda

`MODAL_NAME` to **nazwa typu komendy z klienta NSwag, bez sufiksu `Command`**, w kebab-case.
Jedno źródło prawdy: nazwa klasy komendy w C# (`ProductSetPriceCommand`) → typ w kliencie →
nazwa folderu, plików, klas i stałej `MODAL_ID`.

| Komenda (backend / klient) | Folder | Klasy | `MODAL_ID` |
|---|---|---|---|
| `ProductSetPriceCommand` | `product-set-price/` | `ProductSetPriceModalDefinition`, `ProductSetPriceStepComponent`, `ProductSetPriceMetadata` | `PRODUCT_SET_PRICE_MODAL_ID` |
| `UserAssignRoleCommand` | `user-assign-role/` | `UserAssignRoleModalDefinition`, … | `USER_ASSIGN_ROLE_MODAL_ID` |
| `RoleCreateCommand` | `role-create/` | `RoleCreateModalDefinition`, … | `ROLE_CREATE_MODAL_ID` |

Nazwa **nie skraca się** do samej akcji (`set-price/`, `create-role/`): prefiks agregatu jest
częścią nazwy komendy i to on odróżnia `RoleAddPermissionCommand` od `UserGrantPermissionCommand`.

Nazwa **nie niesie** też słowa `multiple`/`batch`, mimo że endpoint nazywa się
`ProductSetPriceMultipleCommandEndpoint`, a metoda klienta `productSetPriceMultipleCommand`.
Operacja masowa jest domyślnym trybem każdej komendy (pojedyncza edycja to ten sam
`BatchCommand` z jednym uuidem w `targetUuids` — patrz [operacje masowe](../backend/bulk-commands.md#2-endpoint--trzy-tryby-jednego-kontraktu)),
więc wyróżnik w nazwie nic by nie odróżniał.

Selektor kroku dokłada z przodu prefiks modułu: `erp-catalog-product-set-price-step`.

---

## 1. Dlaczego modal jest rejestrowany, a nie importowany bezpośrednio

Moduł `sales` może potrzebować otworzyć modal zdefiniowany w module `catalog` (np. "dodaj produkt do zamówienia") — ale `sales` **nie może** zaimportować kodu `catalog` bezpośrednio, bo to złamałoby granice `scope:X` wymuszone przez ESLint (patrz [architektura frontendu](./architecture.md#tagi-nx)) i, w trybie MFE, oznaczałoby statyczną zależność między dwoma osobno budowanymi aplikacjami.

Rozwiązanie: każdy moduł rejestruje swoje modale pod globalnie unikalnym `MODAL_ID` w warstwie `contract` (jedyna warstwa eksponowana przez Native Federation). Wywołujący zna tylko `MODAL_ID` i typ komendy:

```typescript
modalService.open(PRODUCT_SET_PRICE_MODAL_ID, command);
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

Przed utworzeniem definicji modalu upewnij się, że orkiestrator (np. `CatalogProductOrchestrator`) ma metodę do wykonania komendy (np. `setPriceMultipleAsync`). Jeśli nie — zaimplementuj ją najpierw, wg wzorca komend w [orkiestratorach, sekcja 6](./orchestrators.md#6-komendy-mutacje), i zaimportuj typ komendy z wygenerowanego klienta API.

---

## 4. Krok 1.7 — Teksty (Tłumaczenia)

Wszystkie stałe teksty widoczne dla użytkownika w modalu (tytuł, etykiety kroków, przycisk zapisu, placeholder, komunikaty błędów) idą przez klucze Transloco — zero hardcodowania. Procedura dodawania kluczy + `pnpm translate:keys`: [Tłumaczenia, sekcja 5](./translations.md#5-dodawanie-nowych-kluczy-do-istniejącego-scopeu). Zaimportuj wygenerowany obiekt kluczy (np. `PRODUCT_KEYS`) i używaj go bezpośrednio w definicji modalu i jego komponentach.

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

Klasy w środku noszą tę samą nazwę w PascalCase: `MODAL_NAMEModalDefinition`,
`MODAL_NAMEStepComponent`, `MODAL_NAMEMetadata` — np. `product-set-price/` →
`ProductSetPriceModalDefinition`.

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

Komponent kroku reprezentuje zawartość formularza. **Nie pisz ręcznego HTML/CSS w szablonie** —
cała treść (podsumowanie celów, pola formularza, layout) jest deklaratywnie złożona przez
`ErpStepContentBuilder` i wyrenderowana przez jeden `<erp-step-content [contentConfig]="formContent" />`.
To pokrywa ~90% przypadków; patrz [Atomy UI](./atoms.md) po ogólny wzorzec buildera i
`ErpStepContentBuilder` (`libs/shared/ui/src/lib/atoms/erp-step-content/`) po pełne API
(`addFormField`, `addComponent`, `addSection`, `addBatchTargetsSummary`...).

Dla modalu **operacji masowej** (`BatchCommand<TCommand, TFilter>`, patrz [Zasięg zaznaczenia](./selection-scope.md))
krok rozszerza `ErpBatchStepBase<COMMAND_TYPE, METADATA_TYPE>` — baza dostarcza `targetUuids`,
`isFilterMode`, `targetCount` i blokadę zapisu bez celów. Podsumowanie zaznaczonych pozycji
("Edytujesz N produktów" + lista nazw / hint trybu filtra), wyświetlane jako baner w tym samym
stylu co `erp-selection-scope-banner` (patrz [Zasięg zaznaczenia](./selection-scope.md)), idzie
przez `.addBatchTargetsSummary(...)` zamiast ręcznego `@if (isFilterMode()) {...} @else if (...) {...}`:

```typescript
import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { Validators } from '@angular/forms';
import {
  ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig,
  ErpBatchStepBase, ErpBatchTargetItem,
} from '@erp/shared/ui';
import { COMMAND_TYPE, MODULE_NAMEOrchestrator } from '@erp/MODULE_NAME/data-access';
import { PascalCaseModalNameMetadata } from './MODAL_NAME.definition';
import { MODULE_NAME_KEYS } from '../../translation';

@Component({
  selector: 'erp-MODULE_NAME-MODAL_NAME-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PascalCaseModalNameStepComponent extends ErpBatchStepBase<COMMAND_TYPE, PascalCaseModalNameMetadata> {
  private readonly _orchestrator: MODULE_NAMEOrchestrator;

  /** Zaznaczone pozycje zmapowane na kontrakt podsumowania (nazwa w opisie banera). */
  protected readonly targetItems: Signal<ErpBatchTargetItem[]>;

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    // `super()` jeszcze nie wystartował — żaden odczyt `this.pole` (nawet samo pole klasy) nie
    // jest tu legalny. Zależności idą do zmiennych lokalnych; wartości przekazywane do buildera
    // to gettery (`() => this...`), nie bezpośrednie odczyty — ich ciało wykona się dopiero
    // po pełnej konstrukcji.
    const orchestrator = inject(MODULE_NAMEOrchestrator);

    const config = ErpStepContentBuilder.create(b => b
      .setLayout('stack')
      .addBatchTargetsSummary(s => s
        .setItems(() => this.targetItems())
        .setTargetCount(() => this.targetCount())
        .setIsFilterMode(() => this.isFilterMode())
        .setMessages({
          messageKey: MODULE_NAME_KEYS.commands.modalAction.editMessage,
          suffixSingleKey: MODULE_NAME_KEYS.commands.modalAction.suffixSingle,
          suffixPluralKey: MODULE_NAME_KEYS.commands.modalAction.suffixPlural,
          filterModeSuffixKey: MODULE_NAME_KEYS.commands.modalAction.filterModeSuffix,
          filterModeHintKey: MODULE_NAME_KEYS.commands.modalAction.filterModeHint,
        }),
      )
      .addFormField('fieldName', 'text',
        ib => ib.setLabel(MODULE_NAME_KEYS.commands.modalAction.fieldLabel),
        {
          validators: [Validators.required],
          value: () => this.command()().templateCommand?.fieldName ?? '',
          onChange: (value) => this.command().update((cmd) => ({
            ...cmd,
            templateCommand: { ...cmd.templateCommand, fieldName: value ?? '' },
          })),
        },
      )
    );

    super(config);

    this._orchestrator = orchestrator;
    this.targetItems = computed(() => {
      const vmMap = this._orchestrator.getViewModel()();
      return this.targetUuids()
        .map((uuid) => vmMap.get(uuid))
        .filter((vm): vm is NonNullable<typeof vm> => vm !== undefined)
        .map((vm) => ({ uuid: vm.uuid, label: vm.name }));
    });
    this.formContent = config;
  }
}
```

Dla modalu **nie-masowego** (jeden cel, bez `ErpBatchStepBase`) pomiń `addBatchTargetsSummary` —
zostaje sam `.addFormField(...)`/`.addComponent(...)` w `ErpStepContentBuilder`. Zobacz
gotowe przykłady w repo: `ProductSetNameStepComponent` (`libs/modules/catalog/feature/src/lib/product/modal/product-set-name/`)
dla modalu masowego z ładowaniem nazw z orkiestratora, `UserAssignRoleStepComponent`
(`libs/modules/identity/feature/src/lib/users/modal/user-assign-role/`) dla wielu pól formularza.

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
- [Struktura katalogów agregatu](./feature-structure.md) — gdzie w drzewie `feature` leży katalog `modal/`
- [Orkiestratory](./orchestrators.md) — skąd modal bierze metodę do wywołania w `setOnSave`
- [Nowy moduł](./new-module.md) — jeśli `entry.modals.ts` jeszcze nie istnieje w module
- [Zasięg zaznaczenia](./selection-scope.md) — skąd modal wsadowy bierze cele (`erpBuildBatchTargets`) i `targetCount`
