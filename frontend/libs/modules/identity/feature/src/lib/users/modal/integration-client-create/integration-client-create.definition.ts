import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { IntegrationClientCreateStepComponent } from './integration-client-create.step';
import { IntegrationClientCreateCommand, UserOrchestrator } from '@erp/identity/data-access';
import { USERS_KEYS } from '../../translation';
import { INTEGRATION_CLIENT_CREATE_MODAL_ID } from '@erp/identity/util';

export type IntegrationClientCreateMetadata = Record<string, never>;

/**
 * Modal: rejestracja konta serwisowego (klucza integracyjnego, API-003) — reużywa stronę
 * Użytkownicy zamiast osobnej strony, patrz `docs/backend/identity-authz.md` §2. Wzorowane
 * dosłownie na `RoleCreateModalDefinition` — inna niż tam różnica: `Uuid` NIE jest generowany
 * po stronie klienta, tylko wklejony przez admina (`sub` service-accounta z Keycloaka), więc
 * krok modalu wystawia pole `uuid` do edycji (patrz `integration-client-create.step.ts`).
 *
 * Świadomie NIE wstrzykuje `UsersStore` (page-scoped) — modal jest `providedIn: 'root'`,
 * może teoretycznie zostać otwarty spoza strony `/identity/users`. Po rejestracji konto trafia
 * do cache orkiestratora; admin odnajduje je na liście po zmianie filtra `kind` na „Serwisowe”.
 */
@Injectable({ providedIn: 'root' })
export class IntegrationClientCreateModalDefinition
  implements ErpModalDefinition<IntegrationClientCreateCommand, IntegrationClientCreateMetadata>
{
  public readonly id = INTEGRATION_CLIENT_CREATE_MODAL_ID;
  private readonly _orchestrator = inject(UserOrchestrator);

  public build(
    command: IntegrationClientCreateCommand,
    metadata?: IntegrationClientCreateMetadata,
  ): ErpModalConfig<IntegrationClientCreateCommand, IntegrationClientCreateMetadata> {
    return ErpModalBuilder.modal<IntegrationClientCreateCommand, IntegrationClientCreateMetadata>((b) =>
      b
        .setTitle([USERS_KEYS.title, USERS_KEYS.commands.createIntegrationClient.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(USERS_KEYS.commands.createIntegrationClient.label, IntegrationClientCreateStepComponent)
        .setSaveLabel(USERS_KEYS.commands.createIntegrationClient.submitButton)
        .setOnSave(async (cmd) => {
          await this._orchestrator.createIntegrationClientAsync(cmd);
        }),
    );
  }
}
