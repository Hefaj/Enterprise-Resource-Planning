import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { AssignRoleStepComponent } from './assign-role.step';
import { RoleOrchestrator, UserAssignRoleCommand, UserOrchestrator } from '@erp/identity/data-access';
import { IDENTITY_KEYS } from '../../../translation';
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
        .setTitle([IDENTITY_KEYS.users.title, IDENTITY_KEYS.users.commands.assignRole.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(IDENTITY_KEYS.users.commands.assignRole.label, AssignRoleStepComponent)
        .setSaveLabel(IDENTITY_KEYS.users.commands.assignRole.submitButton)
        .setOnSave(async (cmd) => {
          await this._userOrchestrator.assignRoleAsync(cmd);
        }),
    );
  }
}
