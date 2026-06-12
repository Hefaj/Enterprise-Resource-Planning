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
import { InputTextModule } from 'primeng/inputtext';
import { EditEanCommand } from './edit-ean.types';
import { EditEanMetadata } from './edit-ean.definition';

/**
 * Step komponent do edycji kodu EAN produktu.
 */
@Component({
  selector: 'catalog-edit-ean-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule],
  template: `
    @let _products = products();

    <div class="edit-ean-step">
      <p class="text-surface-600 dark:text-surface-400 text-sm mb-4">
        Edytujesz kod EAN dla
        <strong>{{ _products.length }}</strong>
        {{ _products.length === 1 ? 'produktu' : 'produktów' }}:
      </p>

      <div class="selected-products mb-4">
        @for (p of _products; track p.uuid) {
          <div class="product-badge">
            <i class="pi pi-box text-xs"></i>
            <span>{{ p.sku }}</span>
          </div>
        }
      </div>

      <div class="field">
        <label for="ean-input" class="field-label">
          Kod EAN
          <span class="required-mark">*</span>
        </label>
        <input
          id="ean-input"
          pInputText
          [formControl]="eanControl"
          placeholder="np. 5901234123457"
          class="w-full font-mono"
          [class.p-invalid]="eanControl.invalid && eanControl.touched"
          autocomplete="off"
        />
        @if (eanControl.invalid && eanControl.touched) {
          <small class="field-error">
            @if (eanControl.errors?.['required']) {
              Kod EAN jest wymagany
            } @else if (eanControl.errors?.['pattern']) {
              Kod EAN musi zawierać 8, 12 lub 13 cyfr
            }
          </small>
        }
        <small class="field-hint">Format: EAN-8, EAN-12 lub EAN-13</small>
      </div>
    </div>
  `,
  styles: [`
    .edit-ean-step { padding: 0.25rem 0; }
    .selected-products { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .product-badge {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.2rem 0.6rem; border-radius: 1rem;
      background: var(--p-surface-100); color: var(--p-surface-700);
      font-size: 0.8rem; font-weight: 500; border: 1px solid var(--p-surface-200);
    }
    :host-context(.dark) .product-badge,
    :host-context([data-theme="dark"]) .product-badge {
      background: var(--p-surface-800); color: var(--p-surface-200); border-color: var(--p-surface-700);
    }
    .field { display: flex; flex-direction: column; gap: 0.4rem; }
    .field-label { font-size: 0.875rem; font-weight: 600; color: var(--p-surface-700); }
    :host-context(.dark) .field-label,
    :host-context([data-theme="dark"]) .field-label { color: var(--p-surface-300); }
    .required-mark { color: var(--p-red-500); margin-left: 2px; }
    .field-error { color: var(--p-red-500); font-size: 0.75rem; }
    .field-hint { color: var(--p-surface-400); font-size: 0.75rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditEanStepComponent {
  public command = input.required<WritableSignal<EditEanCommand>>();
  public metadata = input.required<WritableSignal<EditEanMetadata>>();
  public registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  protected eanControl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^\d{8}$|^\d{12}$|^\d{13}$/),
  ]);

  protected products = computed(() => this.command()().products);
  protected canGoNext = computed(() => this.eanControl.valid);

  constructor() {
    effect(() => {
      const register = this.registerCanGoNext();
      if (register) register(this.canGoNext);
    });

    effect(() => {
      const cmd = this.command()();
      if (cmd.ean && this.eanControl.value !== cmd.ean) {
        this.eanControl.setValue(cmd.ean, { emitEvent: false });
      }
    });

    this.eanControl.valueChanges.subscribe((value) => {
      this.command().update((cmd) => ({ ...cmd, ean: value ?? '' }));
    });
  }
}
