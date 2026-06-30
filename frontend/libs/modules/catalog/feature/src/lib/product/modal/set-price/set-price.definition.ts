import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { SetPriceStepComponent } from './set-price.step';
import { CatalogProductOrchestrator, BatchCommandOfProductSetPriceCommand } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation';
import { SET_PRICE_MODAL_ID } from '@erp/catalog/util';

export type SetPriceMetadata = Record<string, never>;

@Injectable({ providedIn: 'root' })
export class SetPriceModalDefinition implements ErpModalDefinition<BatchCommandOfProductSetPriceCommand, SetPriceMetadata> {
  public readonly id = SET_PRICE_MODAL_ID;
  private readonly _orchestrator = inject(CatalogProductOrchestrator);

  public build(command: BatchCommandOfProductSetPriceCommand, metadata?: SetPriceMetadata): ErpModalConfig<BatchCommandOfProductSetPriceCommand, SetPriceMetadata> {
    const uuids = command['products']?.map((p: any) => p.uuid) ?? [];
    if (uuids.length > 0) {
      this._orchestrator.loadAsync(uuids).catch(err => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfProductSetPriceCommand, SetPriceMetadata>((b): void => {
      b.setTitle([PRODUCT_KEYS.base.tabs.products, PRODUCT_KEYS.commands.setPrice.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(PRODUCT_KEYS.commands.setPrice.label, SetPriceStepComponent)
        .setSaveLabel(PRODUCT_KEYS.commands.setPrice.submitButton)
        .setOnSave(async (command): Promise<void> => {
          console.log(command);
          await this._orchestrator.setPriceMultiple(command, SET_PRICE_MODAL_ID);
        });
    });
  }
}
