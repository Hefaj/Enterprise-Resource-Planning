import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig, ErpBatchMetadata } from '@erp/shared/ui';
import { AddMemberStepComponent } from './add-member.step';
import { RoleOrchestrator, BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest } from '@erp/identity/data-access';
import { ROLES_KEYS } from '../../translation';
import { ADD_ROLE_MEMBER_MODAL_ID } from '@erp/identity/util';

/** `excludeUuids` — rola-kontener sama (nie może być swoją własną składową) i role już będące
 * składowymi; wywołujący podaje je tylko w trybie jednego celu. Cykle DALEJ nie są wykrywane
 * klientem — backend waliduje i zwraca `role_cycle_detected`, patrz
 * `docs/backend/identity-authz.md` §2. */
export interface AddMemberMetadata extends ErpBatchMetadata {
  readonly excludeUuids: string[];
}

/** Modal: seryjne dołączenie roli składowej do ról-kontenerów. Wywoływany z panelu szczegółów
 * (`targetUuids: [uuid]`) i z toolbara listy ról (zasięg zaznaczenia). */
@Injectable({ providedIn: 'root' })
export class AddMemberModalDefinition
  implements ErpModalDefinition<BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest, AddMemberMetadata>
{
  public readonly id = ADD_ROLE_MEMBER_MODAL_ID;
  private readonly _roleOrchestrator = inject(RoleOrchestrator);

  public build(
    command: BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest,
    metadata?: AddMemberMetadata,
  ): ErpModalConfig<BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest, AddMemberMetadata> {
    if (command.targetUuids?.length) {
      this._roleOrchestrator.loadAsync(command.targetUuids).catch((err) => console.error(err));
    }

    return ErpModalBuilder.modal<BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest, AddMemberMetadata>((b) =>
      b
        .setTitle([ROLES_KEYS.title, ROLES_KEYS.commands.addMember.modalTitle])
        .setCommand(command)
        .setMetadata(metadata ?? { excludeUuids: [] })
        .addStep(ROLES_KEYS.commands.addMember.label, AddMemberStepComponent)
        .setSaveLabel(ROLES_KEYS.commands.addMember.submitButton)
        .setOnSave(async (cmd) => {
          await this._roleOrchestrator.addMemberMultipleAsync(cmd, ADD_ROLE_MEMBER_MODAL_ID);
        }),
    );
  }
}
