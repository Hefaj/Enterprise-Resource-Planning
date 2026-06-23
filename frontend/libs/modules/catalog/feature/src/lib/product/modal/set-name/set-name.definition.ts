import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { SetNameStepComponent } from './set-name.step';
import { CatalogProductOrchestrator, BatchCommandOfProductSetNameCommand } from '@erp/catalog/data-access';
import { SET_NAME_MODAL_ID } from '@erp/catalog/util';

export interface SetNameMetadata {}

@Injectable({ providedIn: 'root' })
export class SetNameModalDefinition implements ErpModalDefinition<BatchCommandOfProductSetNameCommand, SetNameMetadata> {
  public readonly id = SET_NAME_MODAL_ID;
  private readonly orchestrator = inject(CatalogProductOrchestrator);

  public build(command: BatchCommandOfProductSetNameCommand, metadata?: SetNameMetadata): ErpModalConfig<BatchCommandOfProductSetNameCommand, SetNameMetadata> {
    return ErpModalBuilder.modal<BatchCommandOfProductSetNameCommand, SetNameMetadata>(b => b
      .setTitle(['Produkty', 'Seryjna edycja nazwy'])
      .setCommand(command)
      .setMetadata(metadata)
      .addStep('Nowa nazwa', SetNameStepComponent)
      .setSaveLabel('Ustaw nazwę')
      .setOnSave(async (command, meta) => {
        await this.orchestrator.setNameMultiple(command, SET_NAME_MODAL_ID);
      })
    );
  }
}
