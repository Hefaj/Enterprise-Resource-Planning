import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { CreateRoleStepComponent } from './create-role.step';
import { RoleCreateCommand, RoleOrchestrator } from '@erp/identity/data-access';
import { ROLES_KEYS } from '../../translation';
import { CREATE_ROLE_MODAL_ID } from '@erp/identity/util';

export type CreateRoleMetadata = Record<string, never>;

/** Modal: utworzenie nowej roli. Świadomie NIE wstrzykuje `RolesStore` (page-scoped provider
 * strony `/identity/roles`) — ten modal jest `providedIn: 'root'` i mógłby teoretycznie zostać
 * otwarty spoza tej strony, więc nie zakłada, że store istnieje w drzewie injectorów. Po
 * utworzeniu roli lista i tak się odświeży (dane trafiają do cache orkiestratora), a admin
 * wybiera świeżo utworzoną rolę ręcznie z tabeli. */
@Injectable({ providedIn: 'root' })
export class CreateRoleModalDefinition implements ErpModalDefinition<RoleCreateCommand, CreateRoleMetadata> {
  public readonly id = CREATE_ROLE_MODAL_ID;
  private readonly _orchestrator = inject(RoleOrchestrator);

  public build(command: RoleCreateCommand, metadata?: CreateRoleMetadata): ErpModalConfig<RoleCreateCommand, CreateRoleMetadata> {
    return ErpModalBuilder.modal<RoleCreateCommand, CreateRoleMetadata>((b) =>
      b
        .setTitle([ROLES_KEYS.title, ROLES_KEYS.commands.create.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(ROLES_KEYS.commands.create.label, CreateRoleStepComponent)
        .setSaveLabel(ROLES_KEYS.commands.create.submitButton)
        .setOnSave(async (cmd) => {
          await this._orchestrator.createRoleAsync(cmd);
        }),
    );
  }
}
