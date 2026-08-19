import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Validators } from '@angular/forms';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpModalStepBase } from '@erp/shared/ui';
import { PermissionCatalogOrchestrator, RoleAddPermissionCommand } from '@erp/identity/data-access';
import { AddPermissionMetadata } from './add-permission.definition';
import { IDENTITY_KEYS } from '../../../translation';

@Component({
  selector: 'erp-identity-add-permission-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddPermissionStepComponent extends ErpModalStepBase<RoleAddPermissionCommand, AddPermissionMetadata> {
  private readonly _permissionCatalog = inject(PermissionCatalogOrchestrator);

  protected readonly _availablePermissions = computed(() => {
    const exclude = new Set(this.metadata()().excludeCodes);
    return [...this._permissionCatalog.getViewModel()().values()].filter((p) => !exclude.has(p.code));
  });

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addFormField(
          'permissionCode',
          'inputPicker',
          (f) =>
            f
              .setLabel(IDENTITY_KEYS.roles.commands.addPermission.permissionLabel)
              .setItems(this._availablePermissions)
              .setLabelKey('code')
              .setValueKey('code')
              .setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().permissionCode ?? null,
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, permissionCode: value ?? undefined })),
          },
        ),
    );

    super(config);
    this.formContent = config;
  }
}
