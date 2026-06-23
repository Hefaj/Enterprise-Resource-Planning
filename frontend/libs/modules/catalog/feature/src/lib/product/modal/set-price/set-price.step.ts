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
import { BatchCommandOfProductSetPriceCommand } from '@erp/catalog/data-access';
import { SetPriceMetadata } from './set-price.definition';
import { PRODUCT_KEYS } from '../../translation';
import {
  ErpTextComponent,
  ErpTextBuilder,
  ErpStepContentComponent,
  ErpStepContentBuilder,
  ErpStepContentConfig,
  ErpInputTextBuilder,
} from '@erp/shared/ui';

/**
 * Step komponent do seryjnej edycji ceny produktów.
 */
@Component({
  selector: 'erp-catalog-set-price-step',
  standalone: true,
  imports: [CommonModule, ErpTextComponent, ErpStepContentComponent],
  template: `
    @let _products = products();

    <div class="set-price-step">
      <!-- <p class="text-surface-600 dark:text-surface-400 text-sm mb-4">
        <erp-text [config]="editMessageConfig" />
        <strong>{{ _products.length }}</strong>
        <erp-text [config]="productSuffixConfig()" />:
      </p>

      <div class="selected-products mb-4">
        @for (p of _products; track p.uuid) {
          <div class="product-badge">
            <i class="pi pi-box text-xs"></i>
            <span>{{ p.sku }} ({{ p.price | currency:'PLN':'symbol-narrow':'1.2-2' }})</span>
          </div>
        }
      </div> -->

      <erp-step-content [contentConfig]="formContent" />
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetPriceStepComponent {
  protected readonly keys = PRODUCT_KEYS;

  public command = input.required<WritableSignal<BatchCommandOfProductSetPriceCommand>>();
  public metadata = input.required<WritableSignal<SetPriceMetadata>>();
  public registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  protected readonly editMessageConfig = ErpTextBuilder.create(b => b
    .setValue(PRODUCT_KEYS.commands.setPrice.editMessage)
  );

  protected readonly priceLabelConfig = ErpTextBuilder.create(b => b
    .setValue(PRODUCT_KEYS.commands.setPrice.priceLabel)
  );

  protected readonly priceRequiredConfig = ErpTextBuilder.create(b => b
    .setValue(PRODUCT_KEYS.validations.priceRequired)
  );

  protected readonly priceMinConfig = ErpTextBuilder.create(b => b
    .setValue(PRODUCT_KEYS.validations.priceMin)
  );

  /** Deklaratywna konfiguracja formularza zbudowana przez builder. */
  protected readonly formContent: ErpStepContentConfig;

  /** Referencja do FormControl wyciągnięta z zbudowanego FormGroup. */
  private readonly _priceControl: FormControl<number | null>;

  protected products = computed<{ uuid: string; sku: string; price: number }[]>(() => this.command()()['products'] ?? []);

  protected productSuffixConfig = computed(() => {
    const count = this.products().length;
    return ErpTextBuilder.create(b => b
      .setValue(count === 1 ? PRODUCT_KEYS.commands.setPrice.productSuffixSingle : PRODUCT_KEYS.commands.setPrice.productSuffixPlural)
    );
  });

  protected canGoNext: Signal<boolean>;

  public constructor() {
    // ── Build form content declaratively ──
    this.formContent = ErpStepContentBuilder.content(b => b
      .addForm(f => f
        .setGridCols(1)
        .addField('price', 'text',
          ErpInputTextBuilder.create(ib => ib
            .setPlaceholder(PRODUCT_KEYS.commands.setPrice.priceLabel)
            .setErrorMessages({
              required: PRODUCT_KEYS.validations.priceRequired,
              min: PRODUCT_KEYS.validations.priceMin,
            })
          ),
          { validators: [Validators.required, Validators.min(0.01)] }
        )
      )
    );

    // Extract FormGroup reference from built config for command sync
    const formElement = this.formContent.elements.find(e => e.type === 'form');
    this._priceControl = formElement!.config.formGroup.get('price') as FormControl<number | null>;

    this.canGoNext = computed(() => this._priceControl.valid);

    effect(() => {
      const register = this.registerCanGoNext();
      if (register) register(this.canGoNext);
    });

    effect(() => {
      const cmd = this.command()();
      if (cmd['price'] !== null && this._priceControl.value !== cmd['price']) {
        this._priceControl.setValue(cmd['price'], { emitEvent: false });
      }
    });

    this._priceControl.valueChanges.subscribe((value) => {
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
