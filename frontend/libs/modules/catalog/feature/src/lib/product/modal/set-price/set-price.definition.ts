import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { SetPriceStepComponent } from './set-price.step';
import { CatalogProductOrchestrator, BatchCommandOfProductSetPriceCommandAndSearchProductRequest } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation';
import { SET_PRICE_MODAL_ID } from '@erp/catalog/util';

export type SetPriceMetadata = Record<string, never>;

@Injectable({ providedIn: 'root' })
export class SetPriceModalDefinition implements ErpModalDefinition<BatchCommandOfProductSetPriceCommandAndSearchProductRequest, SetPriceMetadata> {
  public readonly id = SET_PRICE_MODAL_ID;
  private readonly _orchestrator = inject(CatalogProductOrchestrator);

  public build(command: BatchCommandOfProductSetPriceCommandAndSearchProductRequest, metadata?: SetPriceMetadata): ErpModalConfig<BatchCommandOfProductSetPriceCommandAndSearchProductRequest, SetPriceMetadata> {
    const uuids = command['products']?.map((p: any) => p.uuid) ?? [];
    if (uuids.length > 0) {
      this._orchestrator.loadAsync(uuids, { includeCodeTypes: true }).catch(err => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfProductSetPriceCommandAndSearchProductRequest, SetPriceMetadata>((b): void => {
      b.setTitle([PRODUCT_KEYS.base.tabs.products, PRODUCT_KEYS.commands.setPrice.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(PRODUCT_KEYS.commands.setPrice.label, SetPriceStepComponent)
        .addStep(PRODUCT_KEYS.commands.setPrice.label, SetPriceStepComponent)
        .setSaveLabel(PRODUCT_KEYS.commands.setPrice.submitButton)
        .setOnSave(async (command) => {
          return await this._orchestrator.setPriceMultiple(command, SET_PRICE_MODAL_ID);
        });
    });
  }
}
