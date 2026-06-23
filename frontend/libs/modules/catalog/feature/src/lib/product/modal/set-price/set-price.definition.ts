import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { SetPriceStepComponent } from './set-price.step';
import { CatalogProductOrchestrator, BatchCommandOfProductSetPriceCommand } from '@erp/catalog/data-access';
import { SET_PRICE_MODAL_ID } from '@erp/catalog/util';

export interface SetPriceMetadata {}

@Injectable({ providedIn: 'root' })
export class SetPriceModalDefinition implements ErpModalDefinition<BatchCommandOfProductSetPriceCommand, SetPriceMetadata> {
  public readonly id = SET_PRICE_MODAL_ID;
  private readonly orchestrator = inject(CatalogProductOrchestrator);

  public build(command: BatchCommandOfProductSetPriceCommand, metadata?: SetPriceMetadata): ErpModalConfig<BatchCommandOfProductSetPriceCommand, SetPriceMetadata> {
    return ErpModalBuilder.modal<BatchCommandOfProductSetPriceCommand, SetPriceMetadata>(b => b
      .setTitle(['Produkty', 'Seryjna edycja ceny'])
      .setCommand(command)
      .setMetadata(metadata)
      .addStep('Nowa cena', SetPriceStepComponent)
      .setSaveLabel('Ustaw cenę')
      .setOnSave(async (command, meta) => {
        await this.orchestrator.setPriceMultiple(command, SET_PRICE_MODAL_ID);
      })
    );
  }
}
