import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig, ErpBatchMetadata } from '@erp/shared/ui';
import { RoleAddMemberStepComponent } from './role-add-member.step';
import { RoleOrchestrator, BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest } from '@erp/identity/data-access';
import { ROLES_KEYS } from '../../translation';
import { ROLE_ADD_MEMBER_MODAL_ID } from '@erp/identity/util';

/** `excludeUuids` — rola-kontener sama (nie może być swoją własną składową) i role już będące
 * składowymi; wywołujący podaje je tylko w trybie jednego celu. Cykle DALEJ nie są wykrywane
 * klientem — backend waliduje i zwraca `role_cycle_detected`, patrz
 * `docs/architecture/security.md` §2. */
export interface RoleAddMemberMetadata extends ErpBatchMetadata {
  readonly excludeUuids: string[];
}

/** Modal: seryjne dołączenie roli składowej do ról-kontenerów. Wywoływany z panelu szczegółów
 * (`targetUuids: [uuid]`) i z toolbara listy ról (zasięg zaznaczenia). */
@Injectable({ providedIn: 'root' })
export class RoleAddMemberModalDefinition
  implements ErpModalDefinition<BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest, RoleAddMemberMetadata>
{
  public readonly id = ROLE_ADD_MEMBER_MODAL_ID;
  private readonly _roleOrchestrator = inject(RoleOrchestrator);

  public build(
    command: BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest,
    metadata?: RoleAddMemberMetadata,
  ): ErpModalConfig<BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest, RoleAddMemberMetadata> {
    if (command.targetUuids?.length) {
      this._roleOrchestrator.loadAsync(command.targetUuids).catch((err) => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest, RoleAddMemberMetadata>((b) =>
      b
        .setTitle([ROLES_KEYS.title, ROLES_KEYS.commands.addMember.modalTitle])
        .setCommand(command)
        .setMetadata(metadata ?? { excludeUuids: [] })
        .addStep(ROLES_KEYS.commands.addMember.label, RoleAddMemberStepComponent)
        .setSaveLabel(ROLES_KEYS.commands.addMember.submitButton)
        .setOnSave(async (cmd) => {
          await this._roleOrchestrator.addMemberMultipleAsync(cmd, ROLE_ADD_MEMBER_MODAL_ID);
        }),
    );
  }
}
