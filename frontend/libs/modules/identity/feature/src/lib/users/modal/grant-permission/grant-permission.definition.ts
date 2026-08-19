import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { GrantPermissionStepComponent } from './grant-permission.step';
import { PermissionCatalogOrchestrator, UserGrantPermissionCommand, UserOrchestrator } from '@erp/identity/data-access';
import { IDENTITY_KEYS } from '../../../translation';
import { GRANT_USER_PERMISSION_MODAL_ID } from '@erp/identity/util';

export type GrantPermissionMetadata = Record<string, never>;

/** Modal: nadanie uprawnienia bezpośrednio użytkownikowi, z powodem (patrz
 * `docs/backend/identity-authz.md` §2 — uprawnienie bezpośrednie to WYJĄTEK z powodem i
 * audytem, nie równoprawna ścieżka obok ról). */
@Injectable({ providedIn: 'root' })
export class GrantPermissionModalDefinition
  implements ErpModalDefinition<UserGrantPermissionCommand, GrantPermissionMetadata>
{
  public readonly id = GRANT_USER_PERMISSION_MODAL_ID;
  private readonly _userOrchestrator = inject(UserOrchestrator);
  private readonly _permissionCatalog = inject(PermissionCatalogOrchestrator);

  public build(
    command: UserGrantPermissionCommand,
    metadata?: GrantPermissionMetadata,
  ): ErpModalConfig<UserGrantPermissionCommand, GrantPermissionMetadata> {
    this._permissionCatalog.loadAllAsync().catch((err) => console.error(err));

    return ErpModalBuilder.modal<UserGrantPermissionCommand, GrantPermissionMetadata>((b) =>
      b
        .setTitle([IDENTITY_KEYS.users.title, IDENTITY_KEYS.users.commands.grantPermission.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(IDENTITY_KEYS.users.commands.grantPermission.label, GrantPermissionStepComponent)
        .setSaveLabel(IDENTITY_KEYS.users.commands.grantPermission.submitButton)
        .setOnSave(async (cmd) => {
          await this._userOrchestrator.grantPermissionAsync(cmd);
        }),
    );
  }
}
