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
import { BatchCommandOfProductSetPriceCommand } from '@erp/catalog/data-access';
import { SetPriceMetadata } from './set-price.definition';

/**
 * Step komponent do seryjnej edycji ceny produktów.
 */
@Component({
  selector: 'catalog-set-price-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule],
  template: `
    @let _products = products();

    <div class="set-price-step">
      <p class="text-surface-600 dark:text-surface-400 text-sm mb-4">
        Edytujesz cenę netto dla
        <strong>{{ _products.length }}</strong>
        {{ _products.length === 1 ? 'produktu' : 'produktów' }}:
      </p>

      <div class="selected-products mb-4">
        @for (p of _products; track p.uuid) {
          <div class="product-badge">
            <i class="pi pi-box text-xs"></i>
            <span>{{ p.sku }} ({{ p.price | currency:'PLN':'symbol-narrow':'1.2-2' }})</span>
          </div>
        }
      </div>

      <div class="field">
        <label for="price-input" class="field-label">
          Nowa cena netto (PLN)
          <span class="required-mark">*</span>
        </label>
        <input
          id="price-input"
          pInputText
          type="number"
          step="0.01"
          min="0.01"
          [formControl]="priceControl"
          placeholder="np. 99.99"
          class="w-full font-mono"
          [class.p-invalid]="priceControl.invalid && priceControl.touched"
          autocomplete="off"
        />
        @if (priceControl.invalid && priceControl.touched) {
          <small class="field-error">
            @if (priceControl.errors?.['required']) {
              Cena jest wymagana
            } @else if (priceControl.errors?.['min']) {
              Cena musi być większa od 0
            }
          </small>
        }
      </div>
    </div>
  `,
  styles: [`
    .set-price-step { padding: 0.25rem 0; }
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetPriceStepComponent {
  public command = input.required<WritableSignal<BatchCommandOfProductSetPriceCommand>>();
  public metadata = input.required<WritableSignal<SetPriceMetadata>>();
  public registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  protected priceControl = new FormControl<number | null>(null, [
    Validators.required,
    Validators.min(0.01),
  ]);

  protected products = computed<{ uuid: string; sku: string; price: number }[]>(() => this.command()()['products'] ?? []);
  protected canGoNext = computed(() => this.priceControl.valid);

  constructor() {
    effect(() => {
      const register = this.registerCanGoNext();
      if (register) register(this.canGoNext);
    });

    effect(() => {
      const cmd = this.command()();
      if (cmd['price'] !== null && this.priceControl.value !== cmd['price']) {
        this.priceControl.setValue(cmd['price'], { emitEvent: false });
      }
    });

    this.priceControl.valueChanges.subscribe((value) => {
      this.command().update((cmd) => {
        const numPrice = value ? Number(value) : null;
        const commands = (cmd['products'] as { uuid: string; sku: string; price: number }[] || []).map(p => ({
          uuid: p.uuid,
          price: numPrice ?? 0,
        }));
        return {
          ...cmd,
          price: numPrice,
          commands,
        };
      });
    });
  }
}
