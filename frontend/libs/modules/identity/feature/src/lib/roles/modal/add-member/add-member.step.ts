import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Validators } from '@angular/forms';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpModalStepBase } from '@erp/shared/ui';
import { RoleAddMemberCommand, RoleOrchestrator } from '@erp/identity/data-access';
import { AddMemberMetadata } from './add-member.definition';
import { ROLES_KEYS } from '../../translation';

@Component({
  selector: 'erp-identity-add-member-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddMemberStepComponent extends ErpModalStepBase<RoleAddMemberCommand, AddMemberMetadata> {
  private readonly _roleOrchestrator = inject(RoleOrchestrator);

  protected readonly _availableRoles = computed(() => {
    const exclude = new Set(this.metadata()().excludeUuids);
    return [...this._roleOrchestrator.getViewModel()().values()].filter((r) => !exclude.has(r.uuid));
  });

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addFormField(
          'memberRoleUuid',
          'inputPicker',
          (f) => f.setLabel(ROLES_KEYS.commands.addMember.roleLabel).setItems(this._availableRoles).setLabelKey('name').setValueKey('uuid').setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().memberRoleUuid ?? null,
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, memberRoleUuid: value ?? undefined })),
          },
        ),
    );

    super(config);
    this.formContent = config;
  }
}
