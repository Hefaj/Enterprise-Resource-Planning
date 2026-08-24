import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig, ErpBatchMetadata } from '@erp/shared/ui';
import { UserAddPermissionStepComponent } from './user-add-permission.step';
import {
  PermissionCatalogOrchestrator,
  UserOrchestrator,
  BatchCommandOfUserAddPermissionCommandAndSearchUserAccountRequest,
} from '@erp/identity/data-access';
import { USERS_KEYS } from '../../translation';
import { USER_ADD_PERMISSION_MODAL_ID } from '@erp/identity/util';

export type UserAddPermissionMetadata = ErpBatchMetadata;

/** Modal: seryjne nadanie uprawnienia bezpośrednio użytkownikom, z pominięciem ról (patrz
 * `docs/backend/identity-authz.md` §2 — uprawnienie bezpośrednie to WYJĄTEK z powodem i
 * audytem, nie równoprawna ścieżka obok ról). Wywoływany z panelu szczegółów
 * (`targetUuids: [uuid]`) i z toolbara listy (zasięg zaznaczenia) — jak `UserAddRoleModalDefinition`. */
@Injectable({ providedIn: 'root' })
export class UserAddPermissionModalDefinition
  implements ErpModalDefinition<BatchCommandOfUserAddPermissionCommandAndSearchUserAccountRequest, UserAddPermissionMetadata>
{
  public readonly id = USER_ADD_PERMISSION_MODAL_ID;
  private readonly _userOrchestrator = inject(UserOrchestrator);
  private readonly _permissionCatalog = inject(PermissionCatalogOrchestrator);

  public build(
    command: BatchCommandOfUserAddPermissionCommandAndSearchUserAccountRequest,
    metadata?: UserAddPermissionMetadata,
  ): ErpModalConfig<BatchCommandOfUserAddPermissionCommandAndSearchUserAccountRequest, UserAddPermissionMetadata> {
    this._permissionCatalog.loadAllAsync().catch((err) => console.error(err));

    if (command.targetUuids?.length) {
      this._userOrchestrator.loadAsync(command.targetUuids).catch((err) => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfUserAddPermissionCommandAndSearchUserAccountRequest, UserAddPermissionMetadata>((b) =>
      b
        .setTitle([USERS_KEYS.title, USERS_KEYS.commands.addPermission.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(USERS_KEYS.commands.addPermission.label, UserAddPermissionStepComponent)
        .setSaveLabel(USERS_KEYS.commands.addPermission.submitButton)
        .setOnSave(async (cmd) => {
          await this._userOrchestrator.addPermissionMultipleAsync(cmd, USER_ADD_PERMISSION_MODAL_ID);
        }),
    );
  }
}
