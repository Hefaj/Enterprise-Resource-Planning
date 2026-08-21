import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { RoleCreateStepComponent } from './role-create.step';
import { RoleCreateCommand, RoleOrchestrator } from '@erp/identity/data-access';
import { ROLES_KEYS } from '../../translation';
import { ROLE_CREATE_MODAL_ID } from '@erp/identity/util';

export type RoleCreateMetadata = Record<string, never>;

/** Modal: utworzenie nowej roli. Świadomie NIE wstrzykuje `RolesStore` (page-scoped provider
 * strony `/identity/roles`) — ten modal jest `providedIn: 'root'` i mógłby teoretycznie zostać
 * otwarty spoza tej strony, więc nie zakłada, że store istnieje w drzewie injectorów. Po
 * utworzeniu roli lista i tak się odświeży (dane trafiają do cache orkiestratora), a admin
 * wybiera świeżo utworzoną rolę ręcznie z tabeli. */
@Injectable({ providedIn: 'root' })
export class RoleCreateModalDefinition implements ErpModalDefinition<RoleCreateCommand, RoleCreateMetadata> {
  public readonly id = ROLE_CREATE_MODAL_ID;
  private readonly _orchestrator = inject(RoleOrchestrator);

  public build(command: RoleCreateCommand, metadata?: RoleCreateMetadata): ErpModalConfig<RoleCreateCommand, RoleCreateMetadata> {
    return ErpModalBuilder.modal<RoleCreateCommand, RoleCreateMetadata>((b) =>
      b
        .setTitle([ROLES_KEYS.title, ROLES_KEYS.commands.create.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(ROLES_KEYS.commands.create.label, RoleCreateStepComponent)
        .setSaveLabel(ROLES_KEYS.commands.create.submitButton)
        .setOnSave(async (cmd) => {
          await this._orchestrator.createRoleAsync(cmd);
        }),
    );
  }
}
