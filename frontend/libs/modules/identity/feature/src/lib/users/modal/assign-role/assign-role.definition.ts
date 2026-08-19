import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { AssignRoleStepComponent } from './assign-role.step';
import { RoleOrchestrator, UserAssignRoleCommand, UserOrchestrator } from '@erp/identity/data-access';
import { USERS_KEYS } from '../../translation';
import { ASSIGN_USER_ROLE_MODAL_ID } from '@erp/identity/util';

export type AssignRoleMetadata = Record<string, never>;

/** Modal: nadanie roli użytkownikowi. `command.userUuid` jest ustawiony przez wywołującego
 * (panel szczegółów użytkownika) i nieedytowalny w formularzu — jedyne edytowalne pola to
 * `roleUuid` (picker) i opcjonalny `expiresAt`. */
@Injectable({ providedIn: 'root' })
export class AssignRoleModalDefinition implements ErpModalDefinition<UserAssignRoleCommand, AssignRoleMetadata> {
  public readonly id = ASSIGN_USER_ROLE_MODAL_ID;
  private readonly _userOrchestrator = inject(UserOrchestrator);
  private readonly _roleOrchestrator = inject(RoleOrchestrator);

  public build(command: UserAssignRoleCommand, metadata?: AssignRoleMetadata): ErpModalConfig<UserAssignRoleCommand, AssignRoleMetadata> {
    // Dociągamy pełną listę ról dla pickera — role są nieliczne (dziesiątki), więc bez paginacji.
    this._roleOrchestrator.searchAsync({ page: 1, pageSize: 500 }).catch((err) => console.error(err));

    return ErpModalBuilder.modal<UserAssignRoleCommand, AssignRoleMetadata>((b) =>
      b
        .setTitle([USERS_KEYS.title, USERS_KEYS.commands.assignRole.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(USERS_KEYS.commands.assignRole.label, AssignRoleStepComponent)
        .setSaveLabel(USERS_KEYS.commands.assignRole.submitButton)
        .setOnSave(async (cmd) => {
          await this._userOrchestrator.assignRoleAsync(cmd);
        }),
    );
  }
}
