import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';
import { AbstractControl, FormControl, ValidationErrors, Validators } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core';
import {
  ErpInputComponent,
  ErpInputNumberComponent,
  ErpTranslatePipe,
  unwrapSignal,
} from '@erp/shared/ui';
import { ErpProductDraftRow, ErpProductDraftRowsConfig } from './erp-product-draft-rows.types';

/** Czy wiersz nadaje się do wysłania — te same warunki, które waliduje agregat `Product`. */
export function erpIsProductDraftRowValid(row: ErpProductDraftRow | null | undefined): boolean {
  return !!row
    && typeof row.name === 'string'
    && row.name.trim().length > 0
    && typeof row.price === 'number'
    && row.price >= 0;
}

/**
 * Walidator kontrolki trzymającej wiersze: przynajmniej jeden wiersz i każdy kompletny.
 *
 * Eksportowany razem z komponentem, żeby krok modalu bramkował zapis dokładnie tą samą
 * regułą, którą komponent pokazuje przy polach — inaczej przycisk „Utwórz" bywałby aktywny
 * nad wierszem podświetlonym na czerwono.
 */
export function erpProductDraftRowsValidator(control: AbstractControl): ValidationErrors | null {
  const rows = control.value as ErpProductDraftRow[] | null;

  if (!rows || rows.length === 0) {
    return { required: true };
  }

  return rows.every(erpIsProductDraftRowValid) ? null : { incompleteRows: true };
}

/** Stan pojedynczego wiersza: uuid nadany z góry + kontrolki obu pól. */
interface ErpProductDraftRowState {
  readonly uuid: string;
  readonly name: FormControl<string | null>;
  readonly price: FormControl<number | null>;
}

/**
 * Edytor listy nowych produktów — tyle wierszy, ile pozycji ma powstać jedną komendą.
 *
 * Komponent jest prezentacyjny: nie zna orkiestratora ani kontraktu HTTP, a wynik oddaje
 * jako wartość `FormControl` (tablica <see cref="ErpProductDraftRow"/>), tak samo jak atomy
 * formularza z `@erp/shared/ui`. Dzięki temu bramkowanie przycisku zapisu w modalu działa
 * standardową ścieżką walidacji formularza kroku.
 */
@Component({
  selector: 'erp-product-draft-rows',
  standalone: true,
  imports: [ErpInputComponent, ErpInputNumberComponent, ErpTranslatePipe, TuiButton],
  template: `
    @let _rows = rows();
    @let _limitReached = limitReached();

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2 px-1 text-xs font-medium text-[var(--tui-text-secondary)]">
        <span class="flex-1">{{ nameLabel() | erpTranslate }}</span>
        <span class="w-40">{{ priceLabel() | erpTranslate }}</span>
        <span class="w-8"></span>
      </div>

      @for (row of _rows; track row.uuid) {
        <div class="flex items-start gap-2">
          <erp-input class="flex-1" [config]="nameFieldConfig()" [control]="row.name" />
          <erp-input-number class="w-40" [config]="priceFieldConfig()" [control]="row.price" />
          <button
            tuiIconButton
            type="button"
            appearance="flat"
            size="s"
            iconStart="@tui.trash"
            class="mt-1"
            [disabled]="_rows.length === 1"
            [attr.aria-label]="removeRowLabel() | erpTranslate"
            [title]="(removeRowLabel() | erpTranslate) || ''"
            (click)="removeRow(row.uuid)"
          ></button>
        </div>
      }

      <div>
        <button
          tuiButton
          type="button"
          appearance="flat"
          size="s"
          iconStart="@tui.plus"
          [disabled]="_limitReached"
          (click)="addRow()"
        >
          {{ addRowLabel() | erpTranslate }}
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpProductDraftRowsComponent {
  public readonly config = input.required<ErpProductDraftRowsConfig>();
  public readonly control = input<FormControl<ErpProductDraftRow[] | null> | null>(null);

  protected readonly rows = signal<ErpProductDraftRowState[]>([]);

  protected readonly nameLabel = computed(() => unwrapSignal(this.config().nameLabel));
  protected readonly priceLabel = computed(() => unwrapSignal(this.config().priceLabel));
  protected readonly addRowLabel = computed(() => unwrapSignal(this.config().addRowLabel));
  protected readonly removeRowLabel = computed(() => unwrapSignal(this.config().removeRowLabel));

  protected readonly limitReached = computed(() => {
    const maxRows = unwrapSignal(this.config().maxRows);
    return maxRows !== undefined && this.rows().length >= maxRows;
  });

  /** Jedna konfiguracja pola dla wszystkich wierszy — etykiety stoją w nagłówku tabeli,
   * więc wiersz potrzebuje tylko placeholdera i komunikatów błędów. */
  protected readonly nameFieldConfig = computed(() => ({
    placeholder: this.config().namePlaceholder,
    size: 's' as const,
    errorMessages: { required: unwrapSignal(this.config().nameRequiredError) ?? '' },
  }));

  protected readonly priceFieldConfig = computed(() => ({
    placeholder: this.config().pricePlaceholder,
    size: 's' as const,
    mode: 'decimal' as const,
    decimals: 2,
    sign: 'positive' as const,
    min: 0,
    errorMessages: {
      required: unwrapSignal(this.config().priceRequiredError) ?? '',
      min: unwrapSignal(this.config().priceMinError) ?? '',
    },
  }));

  public constructor() {
    // Wiersze startowe biorą się z wartości kontrolki (powrót do kroku, ponowienie zadania);
    // przy pustej wartości zaczynamy od jednego pustego wiersza, żeby użytkownik miał gdzie pisać.
    effect(() => {
      const control = this.control();
      if (!control || untracked(() => this.rows().length > 0)) {
        return;
      }

      untracked(() => {
        const initial = (control.value ?? []).map((row) => this._createRow(row));
        this.rows.set(initial.length > 0 ? initial : [this._createRow()]);
        this._emit();
      });
    });

    // `markAllAsTouched` z modalu dotyka kontrolki kroku, nie kontrolek wierszy — bez tego
    // próba zapisu pustego formularza nie zapaliłaby żadnego komunikatu przy polach.
    effect((onCleanup) => {
      const control = this.control();
      if (!control) {
        return;
      }

      const originalMarkAllAsTouched = control.markAllAsTouched.bind(control);
      control.markAllAsTouched = () => {
        originalMarkAllAsTouched();
        for (const row of untracked(() => this.rows())) {
          row.name.markAsTouched();
          row.price.markAsTouched();
        }
      };

      onCleanup(() => {
        control.markAllAsTouched = originalMarkAllAsTouched;
      });
    });
  }

  protected addRow(): void {
    if (this.limitReached()) {
      return;
    }

    this.rows.update((rows) => [...rows, this._createRow()]);
    this._emit();
  }

  protected removeRow(uuid: string): void {
    // Ostatniego wiersza nie usuwamy — pusty edytor nie ma czego pokazać, a komenda bez
    // pozycji i tak zostałaby odrzucona przez backend („Brak komend do wykonania").
    if (this.rows().length === 1) {
      return;
    }

    this.rows.update((rows) => rows.filter((row) => row.uuid !== uuid));
    this._emit();
  }

  private _createRow(row?: ErpProductDraftRow): ErpProductDraftRowState {
    const newUuid = this.config().newUuid ?? (() => crypto.randomUUID());

    const state: ErpProductDraftRowState = {
      uuid: row?.uuid ?? newUuid(),
      name: new FormControl<string | null>(row?.name ?? null, [Validators.required]),
      price: new FormControl<number | null>(row?.price ?? null, [Validators.required, Validators.min(0)]),
    };

    state.name.valueChanges.subscribe(() => this._emit());
    state.price.valueChanges.subscribe(() => this._emit());

    return state;
  }

  /** Przepisuje stan wierszy do kontrolki kroku — jedyne miejsce, przez które wychodzi wartość. */
  private _emit(): void {
    const control = this.control();
    if (!control) {
      return;
    }

    const value = this.rows().map((row) => ({
      uuid: row.uuid,
      name: (row.name.value ?? '').trim(),
      price: row.price.value,
    }));

    control.setValue(value);
    control.markAsDirty();
  }
}
