import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { SetNameStepComponent } from './set-name.step';
import { CatalogProductOrchestrator, BatchCommandOfProductSetNameCommand } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation';
import { SET_NAME_MODAL_ID } from '@erp/catalog/util';

export type SetNameMetadata = Record<string, never>;

@Injectable({ providedIn: 'root' })
export class SetNameModalDefinition implements ErpModalDefinition<BatchCommandOfProductSetNameCommand, SetNameMetadata> {
  public readonly id = SET_NAME_MODAL_ID;
  private readonly _orchestrator = inject(CatalogProductOrchestrator);

  public build(command: BatchCommandOfProductSetNameCommand, metadata?: SetNameMetadata): ErpModalConfig<BatchCommandOfProductSetNameCommand, SetNameMetadata> {
    return ErpModalBuilder.modal<BatchCommandOfProductSetNameCommand, SetNameMetadata>(b => b
      .setTitle([PRODUCT_KEYS.base.tabs.products, PRODUCT_KEYS.commands.setName.modalTitle])
      .setCommand(command)
      .setMetadata(metadata)
      .addStep(PRODUCT_KEYS.commands.setName.label, SetNameStepComponent)
      .setSaveLabel(PRODUCT_KEYS.commands.setName.submitButton)
      .setOnSave(async (command) => {
        console.log(command);
        await this._orchestrator.setNameMultiple(command, SET_NAME_MODAL_ID);
      })
    );
  }
}
