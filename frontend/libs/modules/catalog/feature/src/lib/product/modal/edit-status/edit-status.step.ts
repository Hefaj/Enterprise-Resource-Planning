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
import { SelectModule } from 'primeng/select';
import { EditStatusCommand, ProductStatus } from './edit-status.types';
import { EditStatusMetadata } from './edit-status.definition';

const STATUS_OPTIONS: { label: string; value: ProductStatus; severity: string; icon: string }[] = [
  { label: 'Aktywny', value: 'Aktywny', severity: 'success', icon: 'pi pi-check-circle' },
  { label: 'Draft', value: 'Draft', severity: 'warn', icon: 'pi pi-pencil' },
  { label: 'Wycofany', value: 'Wycofany', severity: 'danger', icon: 'pi pi-ban' },
  { label: 'Archiwum', value: 'Archiwum', severity: 'secondary', icon: 'pi pi-inbox' },
];

/**
 * Step komponent do edycji statusu produktu.
 */
@Component({
  selector: 'catalog-edit-status-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectModule],
  template: `
    @let _products = products();

    <div class="edit-status-step">
      <p class="text-surface-600 dark:text-surface-400 text-sm mb-4">
        Zmienisz status dla
        <strong>{{ _products.length }}</strong>
        {{ _products.length === 1 ? 'produktu' : 'produktów' }}:
      </p>

      <div class="products-list mb-4">
        @for (p of _products; track p.uuid) {
          <div class="product-row">
            <span class="product-sku">{{ p.sku }}</span>
            @if (p.status) {
              <span class="current-status">{{ p.status }}</span>
            }
          </div>
        }
      </div>

      <div class="field">
        <label for="status-select" class="field-label">
          Nowy status
          <span class="required-mark">*</span>
        </label>
        <p-select
          id="status-select"
          [formControl]="statusControl"
          [options]="statusOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Wybierz status"
          [showClear]="false"
          styleClass="w-full"
        >
          <ng-template #item let-opt>
            <div class="status-option">
              <i [class]="opt.icon" [style.color]="'var(--p-' + opt.severity + '-500)'"></i>
              <span>{{ opt.label }}</span>
            </div>
          </ng-template>
          <ng-template #selectedItem let-opt>
            @if (opt) {
              <div class="status-option">
                <i [class]="opt.icon" [style.color]="'var(--p-' + opt.severity + '-500)'"></i>
                <span>{{ opt.label }}</span>
              </div>
            }
          </ng-template>
        </p-select>
        @if (statusControl.invalid && statusControl.touched) {
          <small class="field-error">Wybierz status</small>
        }
      </div>
    </div>
  `,
  styles: [`
    .edit-status-step { padding: 0.25rem 0; }
    .products-list { display: flex; flex-direction: column; gap: 0.35rem; }
    .product-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.4rem 0.75rem; border-radius: 0.5rem;
      background: var(--p-surface-50); border: 1px solid var(--p-surface-100);
    }
    :host-context(.dark) .product-row,
    :host-context([data-theme="dark"]) .product-row {
      background: var(--p-surface-900); border-color: var(--p-surface-800);
    }
    .product-sku { font-size: 0.875rem; font-weight: 600; font-family: monospace; color: var(--p-surface-700); }
    :host-context(.dark) .product-sku,
    :host-context([data-theme="dark"]) .product-sku { color: var(--p-surface-300); }
    .current-status {
      font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 0.75rem;
      background: var(--p-surface-200); color: var(--p-surface-600);
    }
    .status-option { display: flex; align-items: center; gap: 0.5rem; }
    .field { display: flex; flex-direction: column; gap: 0.4rem; }
    .field-label { font-size: 0.875rem; font-weight: 600; color: var(--p-surface-700); }
    :host-context(.dark) .field-label,
    :host-context([data-theme="dark"]) .field-label { color: var(--p-surface-300); }
    .required-mark { color: var(--p-red-500); margin-left: 2px; }
    .field-error { color: var(--p-red-500); font-size: 0.75rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditStatusStepComponent {
  public command = input.required<WritableSignal<EditStatusCommand>>();
  public metadata = input.required<WritableSignal<EditStatusMetadata>>();
  public registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  protected readonly statusOptions = STATUS_OPTIONS;

  protected statusControl = new FormControl<ProductStatus | null>(null, [
    Validators.required,
  ]);

  protected products = computed(() => this.command()().products);
  protected canGoNext = computed(() => this.statusControl.valid);

  constructor() {
    effect(() => {
      const register = this.registerCanGoNext();
      if (register) register(this.canGoNext);
    });

    effect(() => {
      const cmd = this.command()();
      if (cmd.status && this.statusControl.value !== cmd.status) {
        this.statusControl.setValue(cmd.status, { emitEvent: false });
      }
    });

    this.statusControl.valueChanges.subscribe((value) => {
      this.command().update((cmd) => ({ ...cmd, status: value }));
    });
  }
}
