import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalDefinition, ErpModalConfig } from '@erp/shared/ui';
import { AddMemberStepComponent } from './add-member.step';
import { RoleAddMemberCommand, RoleOrchestrator } from '@erp/identity/data-access';
import { IDENTITY_KEYS } from '../../../translation';
import { ADD_ROLE_MEMBER_MODAL_ID } from '@erp/identity/util';

/** `excludeUuids` — rola-kontener sama (nie może być swoją własną składową) i role już będące
 * składowymi. Cykle DALEJ nie są wykrywane klientem — backend waliduje i zwraca
 * `role_cycle_detected`, patrz `docs/backend/identity-authz.md` §2. */
export interface AddMemberMetadata {
  readonly excludeUuids: string[];
}

@Injectable({ providedIn: 'root' })
export class AddMemberModalDefinition implements ErpModalDefinition<RoleAddMemberCommand, AddMemberMetadata> {
  public readonly id = ADD_ROLE_MEMBER_MODAL_ID;
  private readonly _roleOrchestrator = inject(RoleOrchestrator);

  public build(command: RoleAddMemberCommand, metadata?: AddMemberMetadata): ErpModalConfig<RoleAddMemberCommand, AddMemberMetadata> {
    return ErpModalBuilder.modal<RoleAddMemberCommand, AddMemberMetadata>((b) =>
      b
        .setTitle([IDENTITY_KEYS.roles.title, IDENTITY_KEYS.roles.commands.addMember.modalTitle])
        .setCommand(command)
        .setMetadata(metadata ?? { excludeUuids: [] })
        .addStep(IDENTITY_KEYS.roles.commands.addMember.label, AddMemberStepComponent)
        .setSaveLabel(IDENTITY_KEYS.roles.commands.addMember.submitButton)
        .setOnSave(async (cmd) => {
          await this._roleOrchestrator.addMemberAsync(cmd);
        }),
    );
  }
}
