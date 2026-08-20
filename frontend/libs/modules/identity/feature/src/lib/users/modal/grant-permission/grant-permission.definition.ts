import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig, ErpBatchMetadata } from '@erp/shared/ui';
import { GrantPermissionStepComponent } from './grant-permission.step';
import {
  PermissionCatalogOrchestrator,
  UserOrchestrator,
  BatchCommandOfUserGrantPermissionCommandAndSearchUserAccountRequest,
} from '@erp/identity/data-access';
import { USERS_KEYS } from '../../translation';
import { GRANT_USER_PERMISSION_MODAL_ID } from '@erp/identity/util';

export type GrantPermissionMetadata = ErpBatchMetadata;

/** Modal: seryjne nadanie uprawnienia bezpośrednio użytkownikom, z pominięciem ról (patrz
 * `docs/backend/identity-authz.md` §2 — uprawnienie bezpośrednie to WYJĄTEK z powodem i
 * audytem, nie równoprawna ścieżka obok ról). Wywoływany z panelu szczegółów
 * (`targetUuids: [uuid]`) i z toolbara listy (zasięg zaznaczenia) — jak `AssignRoleModalDefinition`. */
@Injectable({ providedIn: 'root' })
export class GrantPermissionModalDefinition
  implements ErpModalDefinition<BatchCommandOfUserGrantPermissionCommandAndSearchUserAccountRequest, GrantPermissionMetadata>
{
  public readonly id = GRANT_USER_PERMISSION_MODAL_ID;
  private readonly _userOrchestrator = inject(UserOrchestrator);
  private readonly _permissionCatalog = inject(PermissionCatalogOrchestrator);

  public build(
    command: BatchCommandOfUserGrantPermissionCommandAndSearchUserAccountRequest,
    metadata?: GrantPermissionMetadata,
  ): ErpModalConfig<BatchCommandOfUserGrantPermissionCommandAndSearchUserAccountRequest, GrantPermissionMetadata> {
    this._permissionCatalog.loadAllAsync().catch((err) => console.error(err));

    if (command.targetUuids?.length) {
      this._userOrchestrator.loadAsync(command.targetUuids).catch((err) => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfUserGrantPermissionCommandAndSearchUserAccountRequest, GrantPermissionMetadata>((b) =>
      b
        .setTitle([USERS_KEYS.title, USERS_KEYS.commands.grantPermission.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(USERS_KEYS.commands.grantPermission.label, GrantPermissionStepComponent)
        .setSaveLabel(USERS_KEYS.commands.grantPermission.submitButton)
        .setOnSave(async (cmd) => {
          await this._userOrchestrator.grantPermissionMultipleAsync(cmd, GRANT_USER_PERMISSION_MODAL_ID);
        }),
    );
  }
}
