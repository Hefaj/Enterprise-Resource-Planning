import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { SetPriceCommand } from './set-price.types';
import { SetPriceStepComponent } from './set-price.step';
import { CatalogProductOrchestrator } from '@erp/catalog/data-access';

export const SET_PRICE_MODAL_ID = 'catalog.product.set-price';

export interface SetPriceMetadata {}

@Injectable({ providedIn: 'root' })
export class SetPriceModalDefinition implements ErpModalDefinition<SetPriceCommand, SetPriceMetadata> {
  public readonly id = SET_PRICE_MODAL_ID;
  private readonly orchestrator = inject(CatalogProductOrchestrator);

  public build(command: SetPriceCommand, metadata?: SetPriceMetadata): ErpModalConfig<SetPriceCommand, SetPriceMetadata> {
    return ErpModalBuilder.modal<SetPriceCommand, SetPriceMetadata>(b => b
      .setTitle(['Produkty', 'Seryjna edycja ceny'])
      .setCommand(command)
      .setMetadata(metadata)
      .addStep('Nowa cena', SetPriceStepComponent)
      .setSaveLabel('Ustaw cenę')
      .setOnSave(async (cmd) => {
        await this.orchestrator.setPriceMultiple(cmd, SET_PRICE_MODAL_ID);
      })
    );
  }
}
