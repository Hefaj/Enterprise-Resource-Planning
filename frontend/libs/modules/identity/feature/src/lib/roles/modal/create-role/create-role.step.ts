import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Validators } from '@angular/forms';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpModalStepBase } from '@erp/shared/ui';
import { RoleCreateCommand } from '@erp/identity/data-access';
import { CreateRoleMetadata } from './create-role.definition';
import { IDENTITY_KEYS } from '../../../translation';

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
        .addFormField(
          'code',
          'text',
          (f) =>
            f
              .setLabel(IDENTITY_KEYS.roles.commands.create.codeLabel)
              .setPlaceholder(IDENTITY_KEYS.roles.commands.create.codePlaceholder),
          {
            validators: [Validators.required],
            value: () => this.command()().code ?? '',
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, code: value ?? '' })),
          },
        )
        .addFormField(
          'name',
          'text',
          (f) =>
            f
              .setLabel(IDENTITY_KEYS.roles.commands.create.nameLabel)
              .setPlaceholder(IDENTITY_KEYS.roles.commands.create.namePlaceholder),
          {
            validators: [Validators.required],
            value: () => this.command()().name ?? '',
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, name: value ?? '' })),
          },
        )
        .addFormField(
          'description',
          'text',
          (f) =>
            f
              .setLabel(IDENTITY_KEYS.roles.commands.create.descriptionLabel)
              .setPlaceholder(IDENTITY_KEYS.roles.commands.create.descriptionPlaceholder),
          {
            value: () => this.command()().description ?? '',
            onChange: (value) => this.command().update((cmd) => ({ ...cmd, description: value || undefined })),
          },
        ),
    );

    super(config);
    this.formContent = config;
  }
}
