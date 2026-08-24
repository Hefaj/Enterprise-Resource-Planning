import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig, ErpBatchMetadata } from '@erp/shared/ui';
import { UserAddRoleStepComponent } from './user-add-role.step';
import { RoleOrchestrator, UserOrchestrator, BatchCommandOfUserAddRoleCommandAndSearchUserAccountRequest } from '@erp/identity/data-access';
import { USERS_KEYS } from '../../translation';
import { USER_ADD_ROLE_MODAL_ID } from '@erp/identity/util';

/** Modal nie potrzebuje niczego ponad standardowe metadane operacji masowej
 * (`targetCount` — ile użytkowników obejmie operacja w trybie filtra). */
export type UserAddRoleMetadata = ErpBatchMetadata;

/** Modal: seryjne nadanie roli użytkownikom. Wywoływany z dwóch miejsc: panelu szczegółów
 * (`targetUuids: [uuid]` — dokładnie jeden użytkownik) i toolbara listy (zasięg zaznaczenia
 * przez `erpBuildBatchTargets`, patrz `docs/frontend/selection-scope.md` §3) — modal nie musi
 * wiedzieć, które z nich. */
@Injectable({ providedIn: 'root' })
export class UserAddRoleModalDefinition
  implements ErpModalDefinition<BatchCommandOfUserAddRoleCommandAndSearchUserAccountRequest, UserAddRoleMetadata>
{
  public readonly id = USER_ADD_ROLE_MODAL_ID;
  private readonly _userOrchestrator = inject(UserOrchestrator);
  private readonly _roleOrchestrator = inject(RoleOrchestrator);

  public build(
    command: BatchCommandOfUserAddRoleCommandAndSearchUserAccountRequest,
    metadata?: UserAddRoleMetadata,
  ): ErpModalConfig<BatchCommandOfUserAddRoleCommandAndSearchUserAccountRequest, UserAddRoleMetadata> {
    // Dociągamy pełną listę ról dla pickera — role są nieliczne (dziesiątki), więc bez paginacji.
    this._roleOrchestrator.searchAsync({ page: 1, pageSize: 500 }).catch((err) => console.error(err));

    // E-maile zaznaczonych użytkowników pokazuje krok modalu — w trybie filtra nie ma czego
    // dociągać (celów nie zna nawet frontend).
    if (command.targetUuids?.length) {
      this._userOrchestrator.loadAsync(command.targetUuids).catch((err) => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfUserAddRoleCommandAndSearchUserAccountRequest, UserAddRoleMetadata>((b) =>
      b
        .setTitle([USERS_KEYS.title, USERS_KEYS.commands.addRole.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(USERS_KEYS.commands.addRole.label, UserAddRoleStepComponent)
        .setSaveLabel(USERS_KEYS.commands.addRole.submitButton)
        .setOnSave(async (cmd) => {
          await this._userOrchestrator.addRoleMultipleAsync(cmd, USER_ADD_ROLE_MODAL_ID);
        }),
    );
  }
}
