import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig, ErpBatchMetadata } from '@erp/shared/ui';
import { AddPermissionStepComponent } from './add-permission.step';
import { PermissionCatalogOrchestrator, RoleOrchestrator, BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest } from '@erp/identity/data-access';
import { ROLES_KEYS } from '../../translation';
import { ADD_ROLE_PERMISSION_MODAL_ID } from '@erp/identity/util';

/** `excludeCodes` — uprawnienia, które rola ma już przypisane wprost; wywołujący
 * (`role-permissions-tab`, tylko dla trybu jednego celu) podaje je, żeby picker ich nie
 * proponował ponownie. Puste w trybie wsadowym z listy — różne role mogą mieć różne zbiory. */
export interface AddPermissionMetadata extends ErpBatchMetadata {
  readonly excludeCodes: string[];
}

/** Modal: seryjne dodanie uprawnienia rolom. Wywoływany z panelu szczegółów roli
 * (`targetUuids: [uuid]`) i z toolbara listy ról (zasięg zaznaczenia). */
@Injectable({ providedIn: 'root' })
export class AddPermissionModalDefinition
  implements ErpModalDefinition<BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest, AddPermissionMetadata>
{
  public readonly id = ADD_ROLE_PERMISSION_MODAL_ID;
  private readonly _roleOrchestrator = inject(RoleOrchestrator);
  private readonly _permissionCatalog = inject(PermissionCatalogOrchestrator);

  public build(
    command: BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest,
    metadata?: AddPermissionMetadata,
  ): ErpModalConfig<BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest, AddPermissionMetadata> {
    this._permissionCatalog.loadAllAsync().catch((err) => console.error(err));

    if (command.targetUuids?.length) {
      this._roleOrchestrator.loadAsync(command.targetUuids).catch((err) => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest, AddPermissionMetadata>((b) =>
      b
        .setTitle([ROLES_KEYS.title, ROLES_KEYS.commands.addPermission.modalTitle])
        .setCommand(command)
        .setMetadata(metadata ?? { excludeCodes: [] })
        .addStep(ROLES_KEYS.commands.addPermission.label, AddPermissionStepComponent)
        .setSaveLabel(ROLES_KEYS.commands.addPermission.submitButton)
        .setOnSave(async (cmd) => {
          await this._roleOrchestrator.addPermissionMultipleAsync(cmd, ADD_ROLE_PERMISSION_MODAL_ID);
        }),
    );
  }
}
