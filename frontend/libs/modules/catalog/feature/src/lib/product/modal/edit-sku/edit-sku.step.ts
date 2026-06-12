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
import { EditSkuCommand } from './edit-sku.types';
import { EditSkuMetadata } from './edit-sku.definition';

/**
 * Step komponent do edycji kodu SKU produktu.
 */
@Component({
  selector: 'catalog-edit-sku-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule],
  template: `
    @let _products = products();

    <div class="edit-sku-step">
      <p class="text-surface-600 dark:text-surface-400 text-sm mb-4">
        Edytujesz kod SKU dla
        <strong>{{ _products.length }}</strong>
        {{ _products.length === 1 ? 'produktu' : 'produktów' }}:
      </p>

      <div class="selected-products mb-4">
        @for (p of _products; track p.uuid) {
          <div class="product-badge">
            <i class="pi pi-tag text-xs"></i>
            <span>{{ p.sku }}</span>
          </div>
        }
      </div>

      @if (_products.length > 1) {
        <div class="warning-banner mb-4">
          <i class="pi pi-info-circle"></i>
          <span>
            Przy edycji wielu produktów jednocześnie nowy SKU zostanie nadany każdemu
            z osobną numeracją sufiksową (np. SKU-1, SKU-2).
          </span>
        </div>
      }

      <div class="field">
        <label for="sku-input" class="field-label">
          Nowy kod SKU
          <span class="required-mark">*</span>
        </label>
        <input
          id="sku-input"
          pInputText
          [formControl]="skuControl"
          placeholder="np. ELE-001"
          class="w-full font-mono uppercase"
          [class.p-invalid]="skuControl.invalid && skuControl.touched"
          autocomplete="off"
        />
        @if (skuControl.invalid && skuControl.touched) {
          <small class="field-error">
            @if (skuControl.errors?.['required']) {
              Kod SKU jest wymagany
            } @else if (skuControl.errors?.['minlength']) {
              SKU musi mieć co najmniej 3 znaki
            } @else if (skuControl.errors?.['maxlength']) {
              SKU może mieć maksymalnie 50 znaków
            } @else if (skuControl.errors?.['pattern']) {
              SKU może zawierać tylko litery, cyfry, myślniki i podkreślniki
            }
          </small>
        }
      </div>
    </div>
  `,
  styles: [`
    .edit-sku-step { padding: 0.25rem 0; }
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
    .warning-banner {
      display: flex; align-items: flex-start; gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--p-amber-50); border: 1px solid var(--p-amber-200);
      border-radius: 0.5rem; color: var(--p-amber-700); font-size: 0.8rem;
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
export class EditSkuStepComponent {
  public command = input.required<WritableSignal<EditSkuCommand>>();
  public metadata = input.required<WritableSignal<EditSkuMetadata>>();
  public registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  protected skuControl = new FormControl('', [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(50),
    Validators.pattern(/^[A-Za-z0-9_-]+$/),
  ]);

  protected products = computed(() => this.command()().products);
  protected canGoNext = computed(() => this.skuControl.valid);

  constructor() {
    effect(() => {
      const register = this.registerCanGoNext();
      if (register) register(this.canGoNext);
    });

    effect(() => {
      const cmd = this.command()();
      if (cmd.sku && this.skuControl.value !== cmd.sku) {
        this.skuControl.setValue(cmd.sku, { emitEvent: false });
      }
    });

    this.skuControl.valueChanges.subscribe((value) => {
      this.command().update((cmd) => ({ ...cmd, sku: (value ?? '').toUpperCase() }));
    });
  }
}
