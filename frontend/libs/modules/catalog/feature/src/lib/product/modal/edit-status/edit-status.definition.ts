import { ErpModalBuilder, ErpModalDefinition } from '@erp/shared/ui';
import { EditStatusCommand } from './edit-status.types';
import { EditStatusStepComponent } from './edit-status.step';

export const EDIT_STATUS_MODAL_ID = 'catalog.product.edit-status';

export interface EditStatusMetadata {}

export const EDIT_STATUS_MODAL: ErpModalDefinition<EditStatusCommand, EditStatusMetadata> = {
  id: EDIT_STATUS_MODAL_ID,
  build: (command, metadata) => ErpModalBuilder.modal<EditStatusCommand, EditStatusMetadata>(b => b
    .setTitle(['Produkty', 'Zmiana statusu'])
    .setCommand(command)
    .setMetadata(metadata)
    .addStep('Nowy status', EditStatusStepComponent)
    .setSaveLabel('Zmień status')
    .setOnSave(async (cmd) => {
      for (const product of cmd.products) {
        // TODO: zamienić na wywołanie API
        await new Promise<void>((r) => setTimeout(r, 300));
        console.log(`[Mock] PATCH /product/${product.uuid}/status →`, { status: cmd.status });
      }
    })
  ),
};
