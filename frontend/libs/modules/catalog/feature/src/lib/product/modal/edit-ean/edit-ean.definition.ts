import { ErpModalBuilder, ErpModalDefinition } from '@erp/shared/ui';
import { EditEanCommand } from './edit-ean.types';
import { EditEanStepComponent } from './edit-ean.step';

export const EDIT_EAN_MODAL_ID = 'catalog.product.edit-ean';

export interface EditEanMetadata {}

export const EDIT_EAN_MODAL: ErpModalDefinition<EditEanCommand, EditEanMetadata> = {
  id: EDIT_EAN_MODAL_ID,
  build: (command, metadata) => ErpModalBuilder.modal<EditEanCommand, EditEanMetadata>(b => b
    .setTitle(['Produkty', 'Edycja kodu EAN'])
    .setCommand(command)
    .setMetadata(metadata)
    .addStep('Kod EAN', EditEanStepComponent)
    .setSaveLabel('Zapisz EAN')
    .setOnSave(async (cmd, meta) => {
      for (const product of cmd.products) {
        // TODO: zamienić na wywołanie API
        await new Promise<void>((r) => setTimeout(r, 400));
        console.log(`[Mock] PATCH /product/${product.uuid}/ean →`, { ean: cmd.ean });
      }
    })
  ),
};
