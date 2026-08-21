import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  ErpModalStepBase,
  ErpStepContentBuilder,
  ErpStepContentComponent,
  ErpStepContentConfig,
} from '@erp/shared/ui';
import {
  ErpProductDraftRow,
  ErpProductDraftRowsBuilder,
  ErpProductDraftRowsComponent,
  erpProductDraftRowsValidator,
} from '@erp/catalog/ui';
import { BatchCommandOfProductCreateCommandAndSearchProductRequest } from '@erp/catalog/data-access';
import { CreateMetadata } from './create.definition';
import { PRODUCT_KEYS } from '../../translation';

/**
 * Step komponent seryjnego zakładania produktów.
 *
 * Nie rozszerza `ErpBatchStepBase` — ta baza opisuje cele operacji (`targetUuids`/`targetFilter`),
 * a zakładanie żadnych nie ma: produkty dopiero powstają. Pozycje wsadu zbiera edytor wierszy
 * z `@erp/catalog/ui`, a krok tłumaczy je na `commands[]` kontraktu `BatchCommand`.
 */
@Component({
  selector: 'erp-catalog-create-product-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateStepComponent extends ErpModalStepBase<BatchCommandOfProductCreateCommandAndSearchProductRequest, CreateMetadata> {
  /** Deklaratywna konfiguracja treści stepu zbudowana przez builder. */
  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    const config = ErpStepContentBuilder.create(b => b
      .setLayout('stack')
      .addText(PRODUCT_KEYS.commands.create.intro)
      .addCustomFormField(
        'products',
        ErpProductDraftRowsComponent,
        ErpProductDraftRowsBuilder.create(r => r
          .setNameLabel(PRODUCT_KEYS.commands.create.nameLabel)
          .setNamePlaceholder(PRODUCT_KEYS.commands.create.namePlaceholder)
          .setPriceLabel(PRODUCT_KEYS.commands.create.priceLabel)
          .setPricePlaceholder(PRODUCT_KEYS.commands.create.pricePlaceholder)
          .setActionLabels(PRODUCT_KEYS.commands.create.addRow, PRODUCT_KEYS.commands.create.removeRow)
          .setErrorMessages({
            nameRequired: PRODUCT_KEYS.validations.nameRequired,
            priceRequired: PRODUCT_KEYS.validations.priceRequired,
            priceMin: PRODUCT_KEYS.validations.priceNegative,
          })
        ),
        {
          // Ta sama reguła, którą edytor pokazuje przy polach — przycisk zapisu ma być
          // aktywny dokładnie wtedy, gdy każdy wiersz da się wysłać.
          validators: [erpProductDraftRowsValidator],
          // Form → Model. Wywoła się wyłącznie dla poprawnej wartości (patrz `bindForm`),
          // więc `price` nie bywa tu nullem. Uuid nadał edytor przy tworzeniu wiersza —
          // idzie na backend jako identyfikator nowego agregatu.
          onChange: (rows: ErpProductDraftRow[] | null) => {
            this.command().update((cmd) => ({
              ...cmd,
              commands: (rows ?? []).map((row) => ({
                uuid: row.uuid,
                name: row.name,
                price: row.price ?? 0,
              })),
            }));
          },
        },
      )
    );

    super(config);
    this.formContent = config;
  }
}
