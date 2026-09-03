import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';
import { ErpStepContentComponent, ErpStepContentBuilder, ErpStepContentConfig, ErpModalStepBase } from '@erp/shared/ui';
import { IntegrationClientCreateCommand } from '@erp/identity/data-access';
import { IntegrationClientCreateMetadata } from './integration-client-create.definition';
import { USERS_KEYS } from '../../translation';

const GUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** `uuid` musi być dokładnie `sub` service-accounta klienta Keycloaka — admin go wkleja, front
 * tylko pilnuje kształtu GUID-a (backend i tak odrzuci kolizję/nieistniejący token przy
 * pierwszym użyciu, patrz `docs/backend/identity-authz.md` §2). */
function guidValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (!value) return null;
  return GUID_PATTERN.test(value) ? null : { invalidGuid: true };
}

@Component({
  selector: 'erp-identity-integration-client-create-step',
  standalone: true,
  imports: [ErpStepContentComponent],
  template: `<erp-step-content [contentConfig]="formContent" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationClientCreateStepComponent extends ErpModalStepBase<
  IntegrationClientCreateCommand,
  IntegrationClientCreateMetadata
> {
  protected readonly formContent: ErpStepContentConfig;

  public constructor() {
    const config = ErpStepContentBuilder.create((b) =>
      b
        .setLayout('stack')
        .addFormField('uuid', 'text', (f) =>
          f.setLabel(USERS_KEYS.commands.createIntegrationClient.uuidLabel).setPlaceholder(USERS_KEYS.commands.createIntegrationClient.uuidPlaceholder),
        {
          validators: [Validators.required, guidValidator],
          value: () => this.command()().uuid ?? '',
          onChange: (value) => this.command().update((cmd) => ({ ...cmd, uuid: value ?? '' })),
        })
        .addFormField('name', 'text', (f) =>
          f.setLabel(USERS_KEYS.commands.createIntegrationClient.nameLabel).setPlaceholder(USERS_KEYS.commands.createIntegrationClient.namePlaceholder),
        {
          validators: [Validators.required],
          value: () => this.command()().name ?? '',
          onChange: (value) => this.command().update((cmd) => ({ ...cmd, name: value ?? '' })),
        })
        .addFormField('description', 'text', (f) =>
          f
            .setLabel(USERS_KEYS.commands.createIntegrationClient.descriptionLabel)
            .setPlaceholder(USERS_KEYS.commands.createIntegrationClient.descriptionPlaceholder),
        {
          value: () => this.command()().description ?? '',
          onChange: (value) => this.command().update((cmd) => ({ ...cmd, description: value || undefined })),
        }),
    );

    super(config);
    this.formContent = config;
  }
}
