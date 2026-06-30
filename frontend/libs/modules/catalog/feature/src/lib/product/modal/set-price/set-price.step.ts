import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  Signal,
  WritableSignal,
} from '@angular/core';
import { Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BatchCommandOfProductSetPriceCommand, CatalogProductOrchestrator } from '@erp/catalog/data-access';
import { SetPriceMetadata } from './set-price.definition';
import { PRODUCT_KEYS } from '../../translation';
import {
  ErpStepContentComponent,
  ErpStepContentBuilder,
  ErpStepContentConfig,
  ErpInputTextBuilder,
  ErpModalStepBase,
} from '@erp/shared/ui';

/**
 * Step komponent do seryjnej edycji ceny produktów.
 */
@Component({
  selector: 'erp-catalog-set-price-step',
  standalone: true,
  imports: [CommonModule, ErpStepContentComponent],
  template: `
    @let _products = products();
    <div class="set-price-step">
      <div class="set-price-step__badges">
        @for (p of _products; track p.uuid) {
          <div class="set-price-step__badge">
            <i class="pi pi-box text-xs"></i>
            <span>{{ p.sku }} ({{ p.name }})</span>
          </div>
        }
      </div>
      <erp-step-content [contentConfig]="formContent" />
    </div>
  `,
  styles: [`
    .set-price-step { padding: 0.25rem 0; display: flex; flex-direction: column; gap: 0.75rem; }
    .set-price-step__badges { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .set-price-step__badge {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.2rem 0.6rem; border-radius: 1rem;
      background: var(--p-surface-100); color: var(--p-surface-700);
      font-size: 0.8rem; font-weight: 500; border: 1px solid var(--p-surface-200);
    }
    :host-context(.dark) .set-price-step__badge,
    :host-context([data-theme="dark"]) .set-price-step__badge {
      background: var(--p-surface-800); color: var(--p-surface-200); border-color: var(--p-surface-700);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetPriceStepComponent extends ErpModalStepBase<BatchCommandOfProductSetPriceCommand, SetPriceMetadata> {

  /** Deklaratywna konfiguracja formularza zbudowana przez builder. */
  protected readonly formContent: ErpStepContentConfig;
  private readonly _orchestrator = inject(CatalogProductOrchestrator);

  protected products = computed(() => {
    const list = this.command()()['products'] ?? [];
    const vmMap = this._orchestrator.getViewModel()();
    return list.map((p: any) => {
      const details = vmMap.get(p.uuid);
      return {
        uuid: p.uuid,
        sku: p.sku,
        name: details?.name ?? 'Ładowanie...',
      };
    });
  });

  public constructor() {
    super();
    // ── Build form content declaratively ──
    const config = ErpStepContentBuilder.create(b => b
      .addText(computed(() => this.products().at(0)?.name))
      .addFormField('price', 'text', ib => ib
        .setPlaceholder(PRODUCT_KEYS.commands.setPrice.priceLabel)
        .setErrorMessages({
          required: PRODUCT_KEYS.validations.priceRequired,
          min: PRODUCT_KEYS.validations.priceMin,
        })
      ,
      {
        validators: [Validators.required, Validators.min(0.01)],
        value: () => this.command()().commands?.at(0)?.price,
        onChange: (value) => {
          this.command().update((cmd) => {
            const numPrice = value ? Number(value) : null;
            const commands = (cmd['products'] as { uuid: string; sku: string; price: number }[] || []).map((p: any) => ({
              uuid: p.uuid,
              price: numPrice ?? 0,
            }));
            return {
              ...cmd,
              price: numPrice,
              commands,
            };
          });
        }
      })
    );
    ErpStepContentBuilder.bindForm(config, {
      registerCanGoNext: this.registerCanGoNext,
    });
    this.formContent = config;
  }
}
