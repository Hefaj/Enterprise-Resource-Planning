import { Injectable, inject } from '@angular/core';
import { ErpBatchMetadata, ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import {
  BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest,
  CatalogProductOrchestrator,
} from '@erp/catalog/data-access';

import { ProductAddMultimediaStepComponent } from './product-add-multimedia.step';
import { PRODUCT_KEYS } from '../../translation';
import { PRODUCT_ADD_MULTIMEDIA_MODAL_ID } from '@erp/catalog/util';

/**
 * Modal nie potrzebuje niczego ponad standardowe metadane operacji masowej
 * (`targetCount` — ile pozycji obejmie operacja w trybie filtra).
 */
export type ProductAddMultimediaMetadata = ErpBatchMetadata;

/**
 * Modal dodania multimediów do zaznaczonych produktów.
 *
 * Komenda przekazana do `open()` niesie same cele (`targetUuids` albo `targetFilter`),
 * a krok dopisuje `templateCommand.multimediaUuids` — po tym, jak wgra pliki do magazynu
 * i zarejestruje je w katalogu. Zapis jest już tylko zleceniem operacji masowej.
 *
 * <b>Dlaczego zapis nie wgrywa plików.</b> Wgranie odbywa się w kroku, przy wyborze plików
 * (patrz `ProductAddMultimediaStepComponent`): transfer trwa tyle, ile łącze użytkownika,
 * a `setOnSave` ma wrócić natychmiast — tak samo jak w każdej innej operacji masowej.
 */
@Injectable({ providedIn: 'root' })
export class ProductAddMultimediaModalDefinition
  implements ErpModalDefinition<BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest, ProductAddMultimediaMetadata> {
  public readonly id = PRODUCT_ADD_MULTIMEDIA_MODAL_ID;

  private readonly _orchestrator = inject(CatalogProductOrchestrator);

  public build(
    command: BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest,
    metadata?: ProductAddMultimediaMetadata,
  ): ErpModalConfig<BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest, ProductAddMultimediaMetadata> {
    return ErpModalBuilder.modal<BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest, ProductAddMultimediaMetadata>((b): void => {
      b.setTitle([PRODUCT_KEYS.base.tabs.products, PRODUCT_KEYS.commands.addMultimedia.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(PRODUCT_KEYS.commands.addMultimedia.label, ProductAddMultimediaStepComponent)
        .setSaveLabel(PRODUCT_KEYS.commands.addMultimedia.submitButton)
        .setOnSave(async (cmd) => {
          return await this._orchestrator.addMultimediaMultiple(cmd, PRODUCT_ADD_MULTIMEDIA_MODAL_ID);
        });
    });
  }
}
