import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig, ErpBatchMetadata } from '@erp/shared/ui';
import { ProductSetPriceStepComponent } from './product-set-price.step';
import { CatalogProductOrchestrator, BatchCommandOfProductSetPriceCommandAndSearchProductRequest } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation';
import { PRODUCT_SET_PRICE_MODAL_ID } from '@erp/catalog/util';

/** Metadane wsadu — `targetCount` mówi, ile pozycji obejmie operacja (patrz `ErpBatchMetadata`). */
export type ProductSetPriceMetadata = ErpBatchMetadata;

@Injectable({ providedIn: 'root' })
export class ProductSetPriceModalDefinition implements ErpModalDefinition<BatchCommandOfProductSetPriceCommandAndSearchProductRequest, ProductSetPriceMetadata> {
  public readonly id = PRODUCT_SET_PRICE_MODAL_ID;
  private readonly _orchestrator = inject(CatalogProductOrchestrator);

  public build(command: BatchCommandOfProductSetPriceCommandAndSearchProductRequest, metadata?: ProductSetPriceMetadata): ErpModalConfig<BatchCommandOfProductSetPriceCommandAndSearchProductRequest, ProductSetPriceMetadata> {
    // Podgląd cen dotyczy wskazanych produktów — w trybie filtra (`targetFilter`) nie ma czego
    // dociągać, bo cele rozwiąże dopiero backend przy tworzeniu zadania.
    const uuids = command.targetUuids ?? [];
    if (uuids.length > 0) {
      this._orchestrator.loadAsync(uuids, { includeCodeTypes: true }).catch(err => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfProductSetPriceCommandAndSearchProductRequest, ProductSetPriceMetadata>((b): void => {
      b.setTitle([PRODUCT_KEYS.base.tabs.products, PRODUCT_KEYS.commands.setPrice.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(PRODUCT_KEYS.commands.setPrice.label, ProductSetPriceStepComponent)
        .addStep(PRODUCT_KEYS.commands.setPrice.label, ProductSetPriceStepComponent)
        .setSaveLabel(PRODUCT_KEYS.commands.setPrice.submitButton)
        .setOnSave(async (command) => {
          return await this._orchestrator.setPriceMultipleAsync(command, PRODUCT_SET_PRICE_MODAL_ID);
        });
    });
  }
}
