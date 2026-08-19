import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Validators } from '@angular/forms';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpModalStepBase } from '@erp/shared/ui';
import { RoleCreateCommand } from '@erp/identity/data-access';
import { CreateRoleMetadata } from './create-role.definition';
import { ROLES_KEYS } from '../../translation';

@Component({
  selector: 'erp-identity-create-role-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateRoleStepComponent extends ErpModalStepBase<RoleCreateCommand, CreateRoleMetadata> {
  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addFormField('code', 'text', (f) => f.setLabel(ROLES_KEYS.commands.create.codeLabel).setPlaceholder(ROLES_KEYS.commands.create.codePlaceholder), {
          validators: [Validators.required],
          value: () => this.command()().code ?? '',
          onChange: (value) => this.command().update((cmd) => ({ ...cmd, code: value ?? '' })),
        })
        .addFormField('name', 'text', (f) => f.setLabel(ROLES_KEYS.commands.create.nameLabel).setPlaceholder(ROLES_KEYS.commands.create.namePlaceholder), {
          validators: [Validators.required],
          value: () => this.command()().name ?? '',
          onChange: (value) => this.command().update((cmd) => ({ ...cmd, name: value ?? '' })),
        })
        .addFormField('description', 'text', (f) => f.setLabel(ROLES_KEYS.commands.create.descriptionLabel).setPlaceholder(ROLES_KEYS.commands.create.descriptionPlaceholder), {
          value: () => this.command()().description ?? '',
          onChange: (value) => this.command().update((cmd) => ({ ...cmd, description: value || undefined })),
        }),
    );

    super(config);
    this.formContent = config;
  }
}
