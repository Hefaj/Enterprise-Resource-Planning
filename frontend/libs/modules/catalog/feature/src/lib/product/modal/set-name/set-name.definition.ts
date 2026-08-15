import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { SetNameStepComponent } from './set-name.step';
import { CatalogProductOrchestrator, BatchCommandOfProductSetNameCommandAndSearchProductRequest } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation';
import { SET_NAME_MODAL_ID } from '@erp/catalog/util';

export type SetNameMetadata = Record<string, never>;

/**
 * Modal seryjnej zmiany nazwy produktów.
 *
 * Komenda przekazywana do `open()` jest DOKŁADNIE tym, co idzie na API
 * (`BatchCommand<ProductSetNameCommand, SearchProductRequest>`): wywołujący podaje
 * `targetUuids` (zaznaczenie z tabeli) albo `targetFilter`, a krok modalu dopisuje
 * `templateCommand.name`. Żadnych pól pomocniczych „tylko dla UI" w komendzie —
 * kontrakt HTTP jest zamrożony dla klienta NSwag.
 */
@Injectable({ providedIn: 'root' })
export class SetNameModalDefinition implements ErpModalDefinition<BatchCommandOfProductSetNameCommandAndSearchProductRequest, SetNameMetadata> {
  public readonly id = SET_NAME_MODAL_ID;
  private readonly _orchestrator = inject(CatalogProductOrchestrator);

  public build(
    command: BatchCommandOfProductSetNameCommandAndSearchProductRequest,
    metadata?: SetNameMetadata,
  ): ErpModalConfig<BatchCommandOfProductSetNameCommandAndSearchProductRequest, SetNameMetadata> {
    const targetUuids = command.targetUuids ?? [];

    // Nazwy/SKU zaznaczonych produktów pokazuje krok modalu — dociągamy je do cache
    // orkiestratora (typy kodów są potrzebne, żeby `codeValue('SKU')` cokolwiek zwrócił).
    if (targetUuids.length > 0) {
      this._orchestrator.loadAsync(targetUuids, { includeCodeTypes: true }).catch(err => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfProductSetNameCommandAndSearchProductRequest, SetNameMetadata>(b => b
      .setTitle([PRODUCT_KEYS.base.tabs.products, PRODUCT_KEYS.commands.setName.modalTitle])
      .setCommand({ ...command, targetUuids })
      .setMetadata(metadata)
      .addStep(PRODUCT_KEYS.commands.setName.label, SetNameStepComponent)
      .setSaveLabel(PRODUCT_KEYS.commands.setName.submitButton)
      .setOnSave(async (cmd) => {
        // Nazwa jest trymowana po stronie agregatu (`Product.SetName`) — robimy to samo tutaj,
        // żeby to, co użytkownik zobaczy po odświeżeniu, zgadzało się z tym, co wysłał.
        const payload: BatchCommandOfProductSetNameCommandAndSearchProductRequest = {
          templateCommand: { name: (cmd.templateCommand?.name ?? '').trim() },
          targetUuids: cmd.targetUuids,
          targetFilter: cmd.targetFilter,
        };

        return await this._orchestrator.setNameMultiple(payload, SET_NAME_MODAL_ID);
      })
    );
  }
}
