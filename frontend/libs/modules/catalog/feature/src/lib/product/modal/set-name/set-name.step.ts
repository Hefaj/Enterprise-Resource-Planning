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
import { BatchCommandOfProductSetNameCommand } from '@erp/catalog/data-access';
import { SetNameMetadata } from './set-name.definition';
import { PRODUCT_KEYS } from '../../translation';
import { ErpTextComponent, ErpTranslatePipe } from '@erp/shared/ui';

/**
 * Step komponent do seryjnej edycji nazwy produktów.
 */
@Component({
  selector: 'erp-catalog-set-name-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ErpTextComponent, ErpTranslatePipe],
  template: `
    @let _products = products();

    <div class="set-name-step">
      <p class="text-surface-600 dark:text-surface-400 text-sm mb-4">
        <erp-text [config]="{ value: keys.commands.setName.editMessage }" />
        <strong>{{ _products.length }}</strong>
        <erp-text [config]="{ value: _products.length === 1 ? keys.commands.setName.productSuffixSingle : keys.commands.setName.productSuffixPlural }" />:
      </p>

      <div class="selected-products mb-4">
        @for (p of _products; track p.uuid) {
          <div class="product-badge">
            <i class="pi pi-box text-xs"></i>
            <span>{{ p.sku }} ({{ p.name }})</span>
          </div>
        }
      </div>

      <div class="field">
        <label for="name-input" class="field-label">
          <erp-text [config]="{ value: keys.commands.setName.nameLabel }" />
          <span class="required-mark">*</span>
        </label>
        <input
          id="name-input"
          pInputText
          type="text"
          [formControl]="nameControl"
          [placeholder]="(keys.commands.setName.namePlaceholder | erpTranslate) || ''"
          class="w-full"
          [class.p-invalid]="nameControl.invalid && nameControl.touched"
          autocomplete="off"
        />
        @if (nameControl.invalid && nameControl.touched) {
          <small class="field-error">
            @if (nameControl.errors?.['required']) {
              <erp-text [config]="{ value: keys.validations.nameRequired }" />
            }
          </small>
        }
      </div>
    </div>
  `,
  styles: [`
    .set-name-step { padding: 0.25rem 0; }
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
export class SetNameStepComponent {
  protected readonly keys = PRODUCT_KEYS;

  public command = input.required<WritableSignal<BatchCommandOfProductSetNameCommand>>();
  public metadata = input.required<WritableSignal<SetNameMetadata>>();
  public registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  protected nameControl = new FormControl<string | null>(null, [
    Validators.required,
  ]);

  protected products = computed<{ uuid: string; sku: string; name: string }[]>(() => this.command()()['products'] ?? []);
  protected canGoNext = computed(() => this.nameControl.valid);

  public constructor() {
    effect(() => {
      const register = this.registerCanGoNext();
      if (register) register(this.canGoNext);
    });

    effect(() => {
      const cmd = this.command()();
      if (cmd['name'] !== undefined && this.nameControl.value !== cmd['name']) {
        this.nameControl.setValue(cmd['name'], { emitEvent: false });
      }
    });

    this.nameControl.valueChanges.subscribe((value) => {
      this.command().update((cmd) => {
        const commands = (cmd['products'] as { uuid: string; sku: string; name: string }[] || []).map(p => ({
          uuid: p.uuid,
          name: value ?? '',
        }));
        return {
          ...cmd,
          name: value,
          commands,
        };
      });
    });
  }
}
