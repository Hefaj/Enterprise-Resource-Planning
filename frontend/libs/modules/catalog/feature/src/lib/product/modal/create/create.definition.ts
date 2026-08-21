import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import {
  BatchCommandOfProductCreateCommandAndSearchProductRequest,
  CatalogProductOrchestrator,
} from '@erp/catalog/data-access';
import { CREATE_PRODUCT_MODAL_ID } from '@erp/catalog/util';
import { CreateStepComponent } from './create.step';
import { PRODUCT_KEYS } from '../../translation';

/** Zakładanie produktów nie ma celów ani metadanych wsadu — nie ma czego liczyć przed zapisem. */
export type CreateMetadata = Record<string, never>;

/**
 * Modal seryjnego zakładania produktów.
 *
 * Komenda przekazana do `open()` jest DOKŁADNIE tym, co idzie na API
 * (`BatchCommand<ProductCreateCommand, SearchProductRequest>`), a krok wypełnia jej
 * `commands[]` — po jednej pozycji na wiersz. To jedyny sensowny tryb kontraktu dla tej
 * operacji: produkty jeszcze nie istnieją, więc ani `targetUuids`, ani `targetFilter`
 * nie mają czego wskazać.
 */
@Injectable({ providedIn: 'root' })
export class CreateModalDefinition implements ErpModalDefinition<BatchCommandOfProductCreateCommandAndSearchProductRequest, CreateMetadata> {
  public readonly id = CREATE_PRODUCT_MODAL_ID;
  private readonly _orchestrator = inject(CatalogProductOrchestrator);

  public build(
    command: BatchCommandOfProductCreateCommandAndSearchProductRequest,
    metadata?: CreateMetadata,
  ): ErpModalConfig<BatchCommandOfProductCreateCommandAndSearchProductRequest, CreateMetadata> {
    return ErpModalBuilder.modal<BatchCommandOfProductCreateCommandAndSearchProductRequest, CreateMetadata>(b => b
      .setTitle([PRODUCT_KEYS.base.tabs.products, PRODUCT_KEYS.commands.create.modalTitle])
      .setCommand(command)
      .setMetadata(metadata)
      .addStep(PRODUCT_KEYS.commands.create.label, CreateStepComponent)
      .setSaveLabel(PRODUCT_KEYS.commands.create.submitButton)
      .setOnSave(async (cmd) => {
        // Na API idą wyłącznie pozycje wsadu — pola celów zostają puste, bo agregatów,
        // które miałyby nimi zostać wskazane, jeszcze nie ma.
        const payload: BatchCommandOfProductCreateCommandAndSearchProductRequest = {
          commands: (cmd.commands ?? []).map((c) => ({
            uuid: c.uuid,
            // Nazwę trymuje agregat (`Product.ValidateName`) — robimy to samo tutaj, żeby
            // to, co użytkownik zobaczy po odświeżeniu, zgadzało się z tym, co wysłał.
            name: (c.name ?? '').trim(),
            price: c.price,
          })),
        };

        return await this._orchestrator.createMultiple(payload, CREATE_PRODUCT_MODAL_ID);
      })
    );
  }
}
