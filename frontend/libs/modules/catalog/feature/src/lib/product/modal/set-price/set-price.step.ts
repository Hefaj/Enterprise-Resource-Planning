import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  Signal,
  WritableSignal,
} from '@angular/core';
import { Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BatchCommandOfProductSetPriceCommand } from '@erp/catalog/data-access';
import { SetPriceMetadata } from './set-price.definition';
import { PRODUCT_KEYS } from '../../translation';
import {
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
  imports: [CommonModule, ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetPriceStepComponent {
  protected readonly keys = PRODUCT_KEYS;

  public command = input.required<WritableSignal<BatchCommandOfProductSetPriceCommand>>();
  public metadata = input.required<WritableSignal<SetPriceMetadata>>();
  public registerCanGoNext = input<(canGoNext: Signal<boolean>) => void>();

  /** Deklaratywna konfiguracja formularza zbudowana przez builder. */
  protected readonly formContent: ErpStepContentConfig;

  protected products = computed<{ uuid: string; sku: string; price: number }[]>(
    () => this.command()()['products'] ?? []
  );

  public constructor() {
    // ── Build form content declaratively ──
    this.formContent = ErpStepContentBuilder.create(b => b
      .setLayout('grid')
      .setGridCols(2)
      .addFormField('price', 'text',
        ErpInputTextBuilder.create(ib => ib
          .setPlaceholder(PRODUCT_KEYS.commands.setPrice.priceLabel)
          .setErrorMessages({
            required: PRODUCT_KEYS.validations.priceRequired,
            min: PRODUCT_KEYS.validations.priceMin,
          })
        ),
        {
          validators: [Validators.required, Validators.min(0.01)],
          value: () => this.command()().commands?.at(0)?.price,
          onChange: (value) => {
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
          }
        }
      )
    );

    // Automatyczna synchronizacja i rejestracja stanu przejścia dalej
    ErpStepContentBuilder.bindForm(this.formContent, {
      registerCanGoNext: this.registerCanGoNext
    });
  }
}
