import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig, ErpBatchMetadata } from '@erp/shared/ui';
import { AssignRoleStepComponent } from './assign-role.step';
import { RoleOrchestrator, UserOrchestrator, BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest } from '@erp/identity/data-access';
import { USERS_KEYS } from '../../translation';
import { ASSIGN_USER_ROLE_MODAL_ID } from '@erp/identity/util';

/** Modal nie potrzebuje niczego ponad standardowe metadane operacji masowej
 * (`targetCount` — ile użytkowników obejmie operacja w trybie filtra). */
export type AssignRoleMetadata = ErpBatchMetadata;

/** Modal: seryjne nadanie roli użytkownikom. Wywoływany z dwóch miejsc: panelu szczegółów
 * (`targetUuids: [uuid]` — dokładnie jeden użytkownik) i toolbara listy (zasięg zaznaczenia
 * przez `erpBuildBatchTargets`, patrz `docs/frontend/selection-scope.md` §3) — modal nie musi
 * wiedzieć, które z nich. */
@Injectable({ providedIn: 'root' })
export class AssignRoleModalDefinition
  implements ErpModalDefinition<BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest, AssignRoleMetadata>
{
  public readonly id = ASSIGN_USER_ROLE_MODAL_ID;
  private readonly _userOrchestrator = inject(UserOrchestrator);
  private readonly _roleOrchestrator = inject(RoleOrchestrator);

  public build(
    command: BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest,
    metadata?: AssignRoleMetadata,
  ): ErpModalConfig<BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest, AssignRoleMetadata> {
    // Dociągamy pełną listę ról dla pickera — role są nieliczne (dziesiątki), więc bez paginacji.
    this._roleOrchestrator.searchAsync({ page: 1, pageSize: 500 }).catch((err) => console.error(err));

    // E-maile zaznaczonych użytkowników pokazuje krok modalu — w trybie filtra nie ma czego
    // dociągać (celów nie zna nawet frontend).
    if (command.targetUuids?.length) {
      this._userOrchestrator.loadAsync(command.targetUuids).catch((err) => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfUserAssignRoleCommandAndSearchUserAccountRequest, AssignRoleMetadata>((b) =>
      b
        .setTitle([USERS_KEYS.title, USERS_KEYS.commands.assignRole.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(USERS_KEYS.commands.assignRole.label, AssignRoleStepComponent)
        .setSaveLabel(USERS_KEYS.commands.assignRole.submitButton)
        .setOnSave(async (cmd) => {
          await this._userOrchestrator.assignRoleMultipleAsync(cmd, ASSIGN_USER_ROLE_MODAL_ID);
        }),
    );
  }
}
