import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Validators } from '@angular/forms';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpModalStepBase } from '@erp/shared/ui';
import { PermissionCatalogOrchestrator, UserGrantPermissionCommand } from '@erp/identity/data-access';
import { GrantPermissionMetadata } from './grant-permission.definition';
import { USERS_KEYS } from '../../translation';

@Component({
  selector: 'erp-identity-grant-permission-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantPermissionStepComponent extends ErpModalStepBase<UserGrantPermissionCommand, GrantPermissionMetadata> {
  private readonly _permissionCatalog = inject(PermissionCatalogOrchestrator);
  protected readonly _permissions = computed(() => [...this._permissionCatalog.getViewModel()().values()]);

  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addFormField(
          'permissionCode',
          'inputPicker',
          (f) => f.setLabel(USERS_KEYS.commands.grantPermission.permissionLabel).setItems(this._permissions).setLabelKey('code').setValueKey('code').setStrategy('single'),
          {
            validators: [Validators.required],
            value: () => this.command()().permissionCode ?? null,
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, permissionCode: value ?? undefined })),
          },
        )
        .addFormField('reason', 'text', (f) => f.setLabel(USERS_KEYS.commands.grantPermission.reasonLabel).setPlaceholder(USERS_KEYS.commands.grantPermission.reasonPlaceholder), {
          validators: [Validators.required],
          value: () => this.command()().reason ?? '',
          onChange: (value) => this.command().update((cmd) => ({ ...cmd, reason: value ?? '' })),
        }),
    );

    super(config);
    this.formContent = config;
  }
}
