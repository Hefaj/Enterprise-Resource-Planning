---
trigger: manual
---

# Przepis: Nowy modal w module (Lazy Loaded Modal)

Przepis opisuje standard tworzenia nowego modalu w warstwie `feature` modułu monorepo oraz rejestracji go w warstwie `contract` w celu globalnego udostępnienia przez mechanizm dynamicznego ładowania (Module Federation / ErpModalService).

---

## Parametry wejściowe

| Parametr | Wymagany | Opis |
|----------|----------|------|
| `MODULE_NAME` | ✅ | Nazwa modułu w **kebab-case** (np. `catalog`, `sales`) |
| `MODAL_NAME` | ✅ | Nazwa modalu w **kebab-case** (np. `set-price`, `add-discount`) |
| `MODAL_ID` | ✅ | Stała identyfikująca modal (np. `SET_PRICE_MODAL_ID`), zdefiniowana w `@erp/MODULE_NAME/util` |
| `COMMAND_TYPE` | ✅ | Klasa/interfejs komendy przekazywanej do zapisu (np. `BatchCommandOfProductSetPriceCommand`) |
| `METADATA_TYPE` | ❌ | Opcjonalny interfejs metadanych (domyślnie puste `{}`) |

---

## Krok 1: Definicja ID modalu (Util)

Upewnij się, że stała `MODAL_ID` (np. `SET_PRICE_MODAL_ID`) jest zadeklarowana i wyeksportowana w bibliotece `util` danego modułu (ścieżka `@erp/MODULE_NAME/util`).

Jako ID modalu można użyć dowolnego unikalnego hasha (zalecane MD5 generowane z nazwy akcji).
Możesz go wygenerować np. za pomocą Node.js:
```bash
node -e "console.log(require('crypto').createHash('md5').update('MODULE_NAME.entity.action').digest('hex'))"
```

---

## Krok 1.5: Przygotowanie orkiestratora (Data-Access)

Przed utworzeniem definicji modalu, upewnij się, że orkiestrator (np. `CatalogProductOrchestrator`) w bibliotece `data-access` posiada odpowiednią metodę do zapisu danych lub wykonania komendy (np. `setNameMultiple`). Jeśli nie, zaimplementuj ją i zaimportuj odpowiedni typ komendy z wygenerowanego API klienta.

---

## Krok 2: Tworzenie plików modalu (Feature)

Utwórz katalog modalu w odpowiedniej lokalizacji domeny wewnątrz `libs/modules/MODULE_NAME/feature/src/lib/.../modal/MODAL_NAME/`.

Struktura katalogu:
```
modal/MODAL_NAME/
├── MODAL_NAME.definition.ts
├── MODAL_NAME.step.ts
└── index.ts
```

### 2.1 Plik `MODAL_NAME.definition.ts`

Definicja modalu (klasa implementująca `ErpModalDefinition`) odpowiada za konfigurację okna (tytuł, komenda, kroki, akcja zapisu).

```typescript
import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { PascalCaseModalNameStepComponent } from './MODAL_NAME.step';
import { PascalCaseModuleNameProductOrchestrator } from '@erp/MODULE_NAME/data-access'; // Dopasuj serwis orkiestratora
import { MODAL_ID } from '@erp/MODULE_NAME/util';

export interface PascalCaseModalNameMetadata {}

@Injectable({ providedIn: 'root' })
export class PascalCaseModalNameModalDefinition implements ErpModalDefinition<COMMAND_TYPE, PascalCaseModalNameMetadata> {
  public readonly id = MODAL_ID;
  private readonly orchestrator = inject(PascalCaseModuleNameProductOrchestrator);

  public build(command: COMMAND_TYPE, metadata?: PascalCaseModalNameMetadata): ErpModalConfig<COMMAND_TYPE, PascalCaseModalNameMetadata> {
    return ErpModalBuilder.modal<COMMAND_TYPE, PascalCaseModalNameMetadata>(b => b
      .setTitle(['TytułGłówny', 'Podtytuł']) // np. ['Produkty', 'Seryjna edycja ceny']
      .setCommand(command)
      .setMetadata(metadata)
      .addStep('Nazwa Kroku', PascalCaseModalNameStepComponent) // Zawsze dokładnie jeden krok
      .setSaveLabel('Zapisz')
      .setOnSave(async (cmd, meta) => {
        // Wywołaj odpowiednią metodę orkiestratora zapisu
        await this.orchestrator.saveMethodName(cmd, MODAL_ID);
      })
    );
  }
}
```

### 2.2 Plik `MODAL_NAME.step.ts`

Komponent kroku reprezentuje zawartość formularza modalu. Musi przyjmować odpowiednie wejścia (`input.required`) oraz zgłaszać stan walidacji do nadrzędnego formularza modalu przy użyciu `registerCanGoNext`.

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  Signal,
  WritableSignal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext'; // PrimeNG unstyled imports
import { COMMAND_TYPE } from '@erp/MODULE_NAME/data-access';
import { PascalCaseModalNameMetadata } from './MODAL_NAME.definition';

@Component({
  selector: 'erp-MODULE_NAME-MODAL_NAME-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule],
  template: `
    <div class="MODAL_NAME-step">
      <!-- Szablon HTML / Formularz -->
    </div>
  `,
  styles: [`
    /* Style CSS (zgodnie z PrimeNG Unstyled) */
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PascalCaseModalNameStepComponent {
  public command = input.required<WritableSignal<COMMAND_TYPE>>();
  public metadata = input.required<WritableSignal<PascalCaseModalNameMetadata>>();
  public registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  // Przykładowy kontroler formularza
  protected formControl = new FormControl<any>(null, [Validators.required]);

  protected canGoNext = computed(() => this.formControl.valid);

  constructor() {
    // Rejestracja walidacji kroku
    effect(() => {
      const register = this.registerCanGoNext();
      if (register) register(this.canGoNext);
    });

    // Synchronizacja z początkowym stanem komendy (Command -> Form)
    effect(() => {
      const cmd = this.command()();
      // Aktualizuj formControl na podstawie cmd
    });

    // Aktualizacja stanu komendy (Form -> Command)
    this.formControl.valueChanges.subscribe((value) => {
      this.command().update((cmd) => ({
        ...cmd,
        // Zmapuj wartość formularza na komendę
      }));
    });
  }
}
```

### 2.3 Plik `index.ts` (w katalogu modalu)

Wyeksportuj definicje oraz komponenty:
```typescript
export * from './MODAL_NAME.definition';
export * from './MODAL_NAME.step';
export { MODAL_ID } from '@erp/MODULE_NAME/util';
```

---

## Krok 3: Rejestracja publicznego API (Feature)

Upewnij się, że nowy modal jest wyeksportowany w głównym pliku `libs/modules/MODULE_NAME/feature/src/index.ts`. 
Wymaga to również dopisania eksportu w pośrednich plikach `index.ts` w hierarchii folderów (np. w katalogu `libs/modules/MODULE_NAME/feature/src/lib/.../modal/index.ts`).

---

## Krok 4: Globalna rejestracja modalu w Contract

Aby modal mógł być ładowany lazy-loaded przez globalny serwis `ErpModalService` (np. przy wywołaniu z innej części monorepo za pomocą `modalService.open(MODAL_ID, command)`), musi być zarejestrowany w warstwie `contract`.

### 4.1 Plik `libs/modules/MODULE_NAME/contract/src/lib/entry.modals.ts`

Jeśli plik `entry.modals.ts` **nie istnieje** w katalogu `libs/modules/MODULE_NAME/contract/src/lib/`, utwórz go.

Zaktualizuj lub utwórz jego treść:

```typescript
import { MODAL_ID } from '@erp/MODULE_NAME/util';

/**
 * Identyfikatory modali tego modułu rejestrowane podczas STARTUP.
 */
export const remoteModalIds: string[] = [
  // Dodaj ID nowego modalu do tablicy
  MODAL_ID,
];

/**
 * Asynchroniczne leniwe ładowanie tokenu DI definicji modalu.
 */
export async function registerModals(): Promise<any[]> {
  const { PascalCaseModalNameModalDefinition } = await import('@erp/MODULE_NAME/feature');
  return [
    // Zwróć klasę definicji modalu
    PascalCaseModalNameModalDefinition,
  ];
}
```

*Uwaga: W przypadku istniejącego pliku, dopisz import definicji oraz dodaj klasę do zwracanej tablicy obok istniejących definicji.*

### 4.2 Eksport w `libs/modules/MODULE_NAME/contract/src/index.ts`

Upewnij się, że plik `libs/modules/MODULE_NAME/contract/src/index.ts` eksportuje te funkcje:

```typescript
export { registerModals, remoteModalIds } from './lib/entry.modals';
```

