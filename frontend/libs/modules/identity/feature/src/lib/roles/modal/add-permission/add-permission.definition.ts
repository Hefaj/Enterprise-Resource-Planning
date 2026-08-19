import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { AddPermissionStepComponent } from './add-permission.step';
import { PermissionCatalogOrchestrator, RoleAddPermissionCommand, RoleOrchestrator } from '@erp/identity/data-access';
import { ROLES_KEYS } from '../../translation';
import { ADD_ROLE_PERMISSION_MODAL_ID } from '@erp/identity/util';

/** `excludeCodes` — uprawnienia, które rola ma już przypisane wprost; wywołujący
 * (`role-permissions-tab`) podaje je, żeby picker ich nie proponował ponownie. */
export interface AddPermissionMetadata {
  readonly excludeCodes: string[];
}

@Injectable({ providedIn: 'root' })
export class AddPermissionModalDefinition implements ErpModalDefinition<RoleAddPermissionCommand, AddPermissionMetadata> {
  public readonly id = ADD_ROLE_PERMISSION_MODAL_ID;
  private readonly _roleOrchestrator = inject(RoleOrchestrator);
  private readonly _permissionCatalog = inject(PermissionCatalogOrchestrator);

  public build(command: RoleAddPermissionCommand, metadata?: AddPermissionMetadata): ErpModalConfig<RoleAddPermissionCommand, AddPermissionMetadata> {
    this._permissionCatalog.loadAllAsync().catch((err) => console.error(err));

    return ErpModalBuilder.modal<RoleAddPermissionCommand, AddPermissionMetadata>((b) =>
      b
        .setTitle([ROLES_KEYS.title, ROLES_KEYS.commands.addPermission.modalTitle])
        .setCommand(command)
        .setMetadata(metadata ?? { excludeCodes: [] })
        .addStep(ROLES_KEYS.commands.addPermission.label, AddPermissionStepComponent)
        .setSaveLabel(ROLES_KEYS.commands.addPermission.submitButton)
        .setOnSave(async (cmd) => {
          await this._roleOrchestrator.addPermissionAsync(cmd);
        }),
    );
  }
}
