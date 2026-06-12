import { Injectable } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { EditSkuCommand } from './edit-sku.types';
import { EditSkuStepComponent } from './edit-sku.step';

export const EDIT_SKU_MODAL_ID = 'catalog.product.edit-sku';

export interface EditSkuMetadata {}

@Injectable({ providedIn: 'root' })
export class EditSkuModalDefinition implements ErpModalDefinition<EditSkuCommand, EditSkuMetadata> {
  public readonly id = EDIT_SKU_MODAL_ID;

  public build(command: EditSkuCommand, metadata?: EditSkuMetadata): ErpModalConfig<EditSkuCommand, EditSkuMetadata> {
    return ErpModalBuilder.modal<EditSkuCommand, EditSkuMetadata>(b => b
      .setTitle(['Produkty', 'Edycja kodu SKU'])
      .setCommand(command)
      .setMetadata(metadata)
      .addStep('Kod SKU', EditSkuStepComponent)
      .setSaveLabel('Zapisz SKU')
      .setSize('xl')
      .setOnSave(async (cmd) => {
        for (let i = 0; i < cmd.products.length; i++) {
          const sku = cmd.products.length === 1 ? cmd.sku : `${cmd.sku}-${i + 1}`;
          // TODO: zamienić na wywołanie API
          await new Promise<void>((r) => setTimeout(r, 300));
          console.log(`[Mock] PATCH /product/${cmd.products[i].uuid}/sku →`, { sku });
        }
      })
    );
  }
}
